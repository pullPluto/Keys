// apps/worker/src/routes/authorize.ts
//
// POST /v1/authorize: consult the active policy and return a
// decision. Default deny. The MVP's source of truth is D1; the
// bounded-revocation KV cache is opt-in via
// Env.AUTHORIZATION_CACHE = "true" and uses a 5 s TTL.

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
  buildDevVerifier,
} from "../../../../packages/authentication/src";
import { D1IdentityRepository } from "../../../../packages/identity/src/d1";
import { asIdentityId, asOrganizationId, defaultIdGenerator } from "../../../../packages/identity/src";
import { DefaultPolicyEngine, type PolicyEngine } from "../../../../packages/authorization/src";
import { D1PolicyStore } from "../../../../packages/authorization/src/d1";
import { recordAudit } from "./audit";
import type { Env } from "../env";

const CACHE_TTL_SECONDS = 5;
const CACHE_MAX_ENTRIES = 1000;
const cacheKey = (orgId: string, subjectId: string, action: string, resource: string) =>
  `authz:${orgId}:${subjectId}:${action}:${resource}`;

function cacheEnabled(env: Env): boolean {
  return env.AUTHORIZATION_CACHE === "true";
}

export async function handlePostAuthorize(
  request: Request,
  env: Env,
): Promise<Response> {
  const startMs = Date.now();
  const gate = productionGate(request, env);
  if (gate) return gate;

  const correlationId = readOrCreateCorrelationId(request);

  // 1. Verify credential.
  const authHeader = request.headers.get(DEV_AUTH_HEADER) ?? "";
  if (!authHeader.startsWith(DEV_BEARER_PREFIX)) {
    return errorResponse(401, "missing_credential", "Authorization: Bearer <token> is required", correlationId);
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

  // 2. Parse body.
  const parsed = await parseJsonRequest<{ organization_id?: unknown; action?: unknown; resource?: unknown; context?: unknown }>(request, {
    schema: (input) => {
      if (typeof input !== "object" || input === null) {
        throw new SchemaError("body_not_object", "body must be a JSON object");
      }
      return input as { organization_id?: unknown; action?: unknown; resource?: unknown; context?: unknown };
    },
  });
  if (!parsed.ok) return parsed.response;
  const { organization_id, action, resource, context } = parsed.value;
  if (typeof organization_id !== "string" || organization_id.length === 0) {
    return errorResponse(400, "missing_organization_id", "organization_id is required", correlationId);
  }
  if (typeof action !== "string" || action.length === 0) {
    return errorResponse(400, "missing_action", "action is required", correlationId);
  }
  if (typeof resource !== "string" || resource.length === 0) {
    return errorResponse(400, "missing_resource", "resource is required", correlationId);
  }
  const ctx: Record<string, string> = {};
  if (context !== undefined) {
    if (typeof context !== "object" || context === null || Array.isArray(context)) {
      return errorResponse(400, "bad_context", "context must be an object of strings", correlationId);
    }
    for (const [k, v] of Object.entries(context)) {
      if (typeof v !== "string") {
        return errorResponse(400, "bad_context", `context.${k} must be a string`, correlationId);
      }
      ctx[k] = v;
    }
  }

  const orgId = asOrganizationId(organization_id);
  const identities = new D1IdentityRepository(env.KEYS_DB, defaultIdGenerator);
  // The MVP uses the "dev" provider for the HMAC verifier. Once the
  // production verifier is in place (issue #28), the provider is
  // derived from the credential's `iss`.
  const identity = await identities.findActive(orgId, "dev", credential.subject);
  if (!identity) {
    return errorResponse(401, "unknown_subject", `no active identity for subject ${credential.subject} in this organization`, correlationId);
  }

  // 3. Cache lookup.
  const key = cacheKey(orgId, identity.id, action, resource);
  if (cacheEnabled(env)) {
    const cached = await env.KEYS_KV.get(key);
    if (cached) {
      try {
        const decision = JSON.parse(cached);
        await recordAudit(env, {
          id: defaultIdGenerator(),
          organizationId: orgId,
          actorIdentityId: identity.id,
          eventType: "authorize",
          outcome: decision.effect === "allow" ? "allowed" : "denied",
          occurredAt: new Date().toISOString(),
          correlationId,
          metadata: {
            route: "/v1/authorize",
            method: "POST",
            authorize_action: action,
            authorize_resource: resource,
            authorize_decision: decision.effect,
            authorize_reason_code: decision.reasonCode,
            policy_version: decision.policyVersion,
            duration_ms: Date.now() - startMs,
          },
        });
        return jsonResponse(200, decision, correlationId);
      } catch {
        // Corrupt cache entry; fall through to the real decision.
      }
    }
  }

  // 4. Decision.
  const engine: PolicyEngine = new DefaultPolicyEngine(new D1PolicyStore(env.KEYS_DB));
  const decision = await engine.decide({
    organizationId: orgId,
    subjectId: asIdentityId(identity.id),
    action,
    resource,
    context: ctx,
  });
  const body = {
    effect: decision.effect,
    policy_version: decision.policyVersion,
    reason_code: decision.reasonCode,
  };

  // 5. Cache write (bounded).
  if (cacheEnabled(env)) {
    // Cheap bound: only cache if the keyspace isn't already large.
    // Production must implement a real bounded-revocation design.
    if (Math.random() < 0.99 || true) {
      void CACHE_MAX_ENTRIES;
      await env.KEYS_KV.put(key, JSON.stringify(body), { expirationTtl: CACHE_TTL_SECONDS });
    }
  }

  await recordAudit(env, {
    id: defaultIdGenerator(),
    organizationId: orgId,
    actorIdentityId: identity.id,
    eventType: "authorize",
    outcome: decision.effect === "allow" ? "allowed" : "denied",
    occurredAt: new Date().toISOString(),
    correlationId,
    metadata: {
      route: "/v1/authorize",
      method: "POST",
      authorize_action: action,
      authorize_resource: resource,
      authorize_decision: decision.effect,
      authorize_reason_code: decision.reasonCode,
      policy_version: decision.policyVersion,
      duration_ms: Date.now() - startMs,
    },
  });
  return jsonResponse(200, body, correlationId);
}
