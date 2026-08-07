// apps/worker/src/routes/policies.ts
//
// POST /v1/policies: upload a draft policy.
// POST /v1/policies/:id/activate: activate a draft.
//
// Both routes require a verified dev HMAC credential whose
// `sub` (providerSubject) is in Env.MVP_BOOTSTRAP_ADMINS.
// The bootstrap is removed in Phase 4.

import {
  parseJsonRequest,
  errorResponse,
  jsonResponse,
  productionGate,
  readOrCreateCorrelationId,
  SchemaError,
} from "../http/envelope";
import {
  DEV_AUTH_HEADER,
  DEV_BEARER_PREFIX,
  buildVerifier,
} from "../../../../packages/authentication/src";
import {
  PolicyDocument,
  PolicyStore,
  validatePolicyBody,
  PolicyValidationError,
} from "../../../../packages/authorization/src";
import { D1PolicyStore, nextVersion } from "../../../../packages/authorization/src/d1";
import { asOrganizationId, defaultIdGenerator } from "../../../../packages/identity/src";
import { recordAudit } from "./audit";
import type { Env } from "../env";

function isBootstrapAdmin(env: Env, subject: string): boolean {
  if (!env.MVP_BOOTSTRAP_ADMINS) return false;
  let admins: string[] = [];
  try {
    const parsed = JSON.parse(env.MVP_BOOTSTRAP_ADMINS);
    if (Array.isArray(parsed)) admins = parsed.filter((s): s is string => typeof s === "string");
  } catch {
    return false;
  }
  return admins.includes(subject);
}

async function requireBootstrapAdmin(
  request: Request,
  env: Env,
): Promise<{ ok: true; subject: string; correlationId: string } | { ok: false; response: Response }> {
  const correlationId = readOrCreateCorrelationId(request);
  const authHeader = request.headers.get(DEV_AUTH_HEADER) ?? "";
  if (!authHeader.startsWith(DEV_BEARER_PREFIX)) {
    return {
      ok: false,
      response: errorResponse(401, "missing_credential", "Authorization: Bearer <token> is required", correlationId),
    };
  }
  const token = authHeader.slice(DEV_BEARER_PREFIX.length).trim();
  const verifier = buildVerifier(env);
  let credential;
  try {
    credential = await verifier.verify(token);
  } catch (e) {
    return {
      ok: false,
      response: errorResponse(
        (e as { status?: number }).status ?? 401,
        (e as { code?: string }).code ?? "credential_error",
        (e as Error).message,
        correlationId,
      ),
    };
  }
  if (!isBootstrapAdmin(env, credential.subject)) {
    return {
      ok: false,
      response: errorResponse(
        403,
        "not_bootstrap_admin",
        `subject ${credential.subject} is not a bootstrap admin`,
        correlationId,
      ),
    };
  }
  return { ok: true, subject: credential.subject, correlationId };
}

function getStore(env: Env): PolicyStore {
  return new D1PolicyStore(env.KEYS_DB);
}

export async function handlePostPolicy(
  request: Request,
  env: Env,
): Promise<Response> {
  const startMs = Date.now();
  const gate = productionGate(request, env);
  if (gate) return gate;

  const auth = await requireBootstrapAdmin(request, env);
  if (!auth.ok) return auth.response;
  const { correlationId } = auth;

  const parsed = await parseJsonRequest<{ organization_id?: unknown; document?: unknown }>(request, {
    schema: (input) => {
      if (typeof input !== "object" || input === null) {
        throw new SchemaError("body_not_object", "body must be a JSON object");
      }
      return input as { organization_id?: unknown; document?: unknown };
    },
  });
  if (!parsed.ok) return parsed.response;
  const { organization_id, document } = parsed.value;

  if (typeof organization_id !== "string" || organization_id.length === 0) {
    return errorResponse(400, "missing_organization_id", "organization_id is required", correlationId);
  }
  let body;
  try {
    body = validatePolicyBody(document);
  } catch (e) {
    if (e instanceof PolicyValidationError) {
      return errorResponse(400, e.code, e.message, correlationId);
    }
    throw e;
  }

  const store = getStore(env);
  const version = await nextVersion(env.KEYS_DB, asOrganizationId(organization_id));
  const now = new Date().toISOString();
  const doc: PolicyDocument = {
    id: defaultIdGenerator(),
    organizationId: asOrganizationId(organization_id),
    version,
    document: body,
    status: "draft",
    createdAt: now,
    activatedAt: null,
  };
  try {
    await store.insert(doc);
  } catch (e) {
    await recordAudit(env, {
      id: defaultIdGenerator(),
      organizationId: organization_id,
      actorIdentityId: null,
      eventType: "policies.create",
      outcome: "error",
      occurredAt: now,
      correlationId,
      metadata: {
        route: "/v1/policies",
        method: "POST",
        policy_version: version,
        duration_ms: Date.now() - startMs,
        error_code: (e as { code?: string }).code ?? "internal_error",
      },
    });
    return errorResponse(500, "internal_error", "failed to create policy", correlationId);
  }
  await recordAudit(env, {
    id: defaultIdGenerator(),
    organizationId: organization_id,
    actorIdentityId: null,
    eventType: "policies.create",
    outcome: "allowed",
    occurredAt: now,
    correlationId,
    metadata: {
      route: "/v1/policies",
      method: "POST",
      policy_id: doc.id,
      policy_version: version,
      policy_admin_id: auth.subject,
      duration_ms: Date.now() - startMs,
    },
  });
  return jsonResponse(
    201,
    {
      id: doc.id,
      organization_id: doc.organizationId,
      version: doc.version,
      status: doc.status,
      created_at: doc.createdAt,
      activated_at: doc.activatedAt,
    },
    correlationId,
  );
}

export async function handlePostPolicyActivate(
  request: Request,
  env: Env,
  policyId: string,
): Promise<Response> {
  const startMs = Date.now();
  const gate = productionGate(request, env);
  if (gate) return gate;

  const auth = await requireBootstrapAdmin(request, env);
  if (!auth.ok) return auth.response;
  const { correlationId } = auth;

  const store = getStore(env);
  const existing = await store.findById(policyId);
  if (!existing) {
    return errorResponse(404, "policy_not_found", `no policy with id ${policyId}`, correlationId);
  }
  const now = new Date().toISOString();
  let activated;
  try {
    activated = await store.activate(policyId, now);
  } catch (e) {
    await recordAudit(env, {
      id: defaultIdGenerator(),
      organizationId: existing.organizationId,
      actorIdentityId: null,
      eventType: "policies.activate",
      outcome: "error",
      occurredAt: now,
      correlationId,
      metadata: {
        route: `/v1/policies/${policyId}/activate`,
        method: "POST",
        policy_id: policyId,
        policy_version: existing.version,
        duration_ms: Date.now() - startMs,
        error_code: (e as { code?: string }).code ?? "internal_error",
      },
    });
    return errorResponse(500, "internal_error", (e as Error).message, correlationId);
  }
  await recordAudit(env, {
    id: defaultIdGenerator(),
    organizationId: activated.organizationId,
    actorIdentityId: null,
    eventType: "policies.activate",
    outcome: "allowed",
    occurredAt: now,
    correlationId,
    metadata: {
      route: `/v1/policies/${policyId}/activate`,
      method: "POST",
      policy_id: activated.id,
      policy_version: activated.version,
      policy_admin_id: auth.subject,
      duration_ms: Date.now() - startMs,
    },
  });
  return jsonResponse(
    200,
    {
      id: activated.id,
      organization_id: activated.organizationId,
      version: activated.version,
      status: activated.status,
      created_at: activated.createdAt,
      activated_at: activated.activatedAt,
    },
    correlationId,
  );
}
