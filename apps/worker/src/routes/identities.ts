// apps/worker/src/routes/identities.ts
//
// POST /v1/identities: register an external identity link under
// a tenant. The MVP is dev/staging-only and the dev HMAC
// verifier authenticates the request. Production refuses.

import {
  parseJsonRequest,
  errorResponse,
  jsonResponse,
  productionGate,
  readOrCreateCorrelationId,
  SchemaError,
} from "../http/envelope";
import { DEV_AUTH_HEADER, DEV_BEARER_PREFIX } from "../../../../packages/authentication/src";
import { buildDevVerifier, resolvePrincipal } from "../../../../packages/authentication/src";
import { D1IdentityRepository, D1OrganizationRepository } from "../../../../packages/identity/src/d1";
import {
  asOrganizationId,
  defaultIdGenerator,
  IdentityService,
} from "../../../../packages/identity/src";
import { recordAudit } from "./audit";
import type { Env } from "../env";

export async function handlePostIdentity(
  request: Request,
  env: Env,
): Promise<Response> {
  const startMs = Date.now();
  const gate = productionGate(request, env);
  if (gate) return gate;

  const correlationId = readOrCreateCorrelationId(request);

  // 1. Verify the dev credential.
  const authHeader = request.headers.get(DEV_AUTH_HEADER) ?? "";
  if (!authHeader.startsWith(DEV_BEARER_PREFIX)) {
    return errorResponse(
      401,
      "missing_credential",
      "Authorization: Bearer <token> is required",
      correlationId,
    );
  }
  const token = authHeader.slice(DEV_BEARER_PREFIX.length).trim();
  const verifier = buildDevVerifier(env);
  let credential;
  try {
    credential = await verifier.verify(token);
  } catch (e) {
    return errorResponse(
      (e as { status?: number }).status ?? 401,
      (e as { code?: string }).code ?? "credential_error",
      (e as Error).message,
      correlationId,
    );
  }

  // 2. Parse the body.
  const parsed = await parseJsonRequest<{ organization_id?: unknown; provider?: unknown }>(request, {
    schema: (input) => {
      if (typeof input !== "object" || input === null) {
        throw new SchemaError("body_not_object", "body must be a JSON object");
      }
      return input as { organization_id?: unknown; provider?: unknown };
    },
  });
  if (!parsed.ok) return parsed.response;
  const { organization_id, provider } = parsed.value;

  if (typeof organization_id !== "string" || organization_id.length === 0) {
    return errorResponse(400, "missing_organization_id", "organization_id is required", correlationId);
  }
  if (typeof provider !== "string" || provider.length === 0) {
    return errorResponse(400, "missing_provider", "provider is required", correlationId);
  }

  const orgId = asOrganizationId(organization_id);
  const orgsRepo = new D1OrganizationRepository(env.KEYS_DB);
  const identitiesRepo = new D1IdentityRepository(env.KEYS_DB, defaultIdGenerator);
  const identityService = new IdentityService(orgsRepo, identitiesRepo);

  let result;
  try {
    result = await identityService.register({
      organizationId: orgId,
      provider,
      providerSubject: credential.subject,
    });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    const code = (e as { code?: string }).code ?? "internal_error";
    await recordAudit(env, {
      id: defaultIdGenerator(),
      organizationId: organization_id,
      actorIdentityId: null,
      eventType: "identities.register",
      outcome: "error",
      occurredAt: new Date().toISOString(),
      correlationId,
      metadata: {
        route: "/v1/identities",
        method: "POST",
        provider,
        duration_ms: Date.now() - startMs,
        error_code: code,
      },
    });
    if (status >= 400 && status < 500) {
      return errorResponse(status, code, (e as Error).message, correlationId);
    }
    return errorResponse(500, "internal_error", "failed to register identity", correlationId);
  }

  await recordAudit(env, {
    id: defaultIdGenerator(),
    organizationId: organization_id,
    actorIdentityId: result.identity.id,
    eventType: "identities.register",
    outcome: "allowed",
    occurredAt: new Date().toISOString(),
    correlationId,
    metadata: {
      route: "/v1/identities",
      method: "POST",
      provider,
      identity_id: result.identity.id,
      duration_ms: Date.now() - startMs,
    },
  });
  return jsonResponse(
    result.created ? 201 : 200,
    {
      id: result.identity.id,
      organization_id: result.identity.organizationId,
      provider: result.identity.provider,
      provider_subject: result.identity.providerSubject,
      status: result.identity.status,
      created_at: result.identity.createdAt,
    },
    correlationId,
  );
}

/** POST /v1/auth/verify: dev-only HMAC verifier. Returns the
 *  verified principal (or 401). The dev HMAC verifier is the
 *  M1.4 implementation; production refuses. */
export async function handlePostAuthVerify(
  request: Request,
  env: Env,
): Promise<Response> {
  const gate = productionGate(request, env);
  if (gate) return gate;

  const correlationId = readOrCreateCorrelationId(request);
  const authHeader = request.headers.get(DEV_AUTH_HEADER) ?? "";
  if (!authHeader.startsWith(DEV_BEARER_PREFIX)) {
    return errorResponse(
      401,
      "missing_credential",
      "Authorization: Bearer <token> is required",
      correlationId,
    );
  }
  const token = authHeader.slice(DEV_BEARER_PREFIX.length).trim();
  const verifier = buildDevVerifier(env);
  try {
    const credential = await verifier.verify(token);
    return jsonResponse(
      200,
      {
        issuer: credential.issuer,
        audience: credential.audience,
        subject: credential.subject,
        expires_at: credential.expiresAt.toISOString(),
      },
      correlationId,
    );
  } catch (e) {
    return errorResponse(
      (e as { status?: number }).status ?? 401,
      (e as { code?: string }).code ?? "credential_error",
      (e as Error).message,
      correlationId,
    );
  }
}
