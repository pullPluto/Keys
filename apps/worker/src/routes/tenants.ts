// apps/worker/src/routes/tenants.ts
//
// POST /v1/tenants: create a draft organization. The MVP lets any
// request that passes the envelope create a tenant; production
// must gate this behind a registered application with the
// `tenants.create` capability.

import { isValidOrgSlug, parseJsonRequest, errorResponse, jsonResponse, productionGate } from "../http/envelope";
import { asOrganizationId, DefaultTenantService, type Organization, type TenantService } from "../../../../packages/identity/src";
import { D1OrganizationRepository } from "../../../../packages/identity/src/d1";
import { defaultIdGenerator } from "../../../../packages/identity/src";
import { recordAudit } from "./audit";
import type { Env } from "../env";

export interface TenantsDeps {
  services: TenantService;
  organizationIdFor: (slug: string) => Promise<Organization | null>;
  newAuditId: () => string;
}

export async function handlePostTenant(
  request: Request,
  env: Env,
  deps?: Partial<TenantsDeps>,
): Promise<Response> {
  const startMs = Date.now();
  const gate = productionGate(request, env);
  if (gate) return gate;

  const parsed = await parseJsonRequest<{ slug: unknown }>(request, {
    schema: (input) => {
      if (typeof input !== "object" || input === null) {
        throw new Error("body must be an object");
      }
      return input as { slug: unknown };
    },
  });
  if (!parsed.ok) return parsed.response;
  const { correlationId } = parsed;
  const { slug } = parsed.value;

  if (!isValidOrgSlug(slug)) {
    return errorResponse(
      400,
      "invalid_slug",
      "slug must match the org-slug rules; see docs/security/authentication.md",
      correlationId,
    );
  }

  // Build the service. Tests can inject one; production goes through
  // the D1 repository. We always use the D1 repo for the "exists"
  // check after creation so the test harness can verify the row.
  const service =
    deps?.services ??
    new DefaultTenantService(new D1OrganizationRepository(env.KEYS_DB), defaultIdGenerator);
  const newAuditId = deps?.newAuditId ?? defaultIdGenerator;

  try {
    const org = await service.createDraft({ slug });
    await recordAudit(env, {
      id: newAuditId(),
      organizationId: org.id,
      actorIdentityId: null,
      eventType: "tenants.create",
      outcome: "allowed",
      occurredAt: new Date().toISOString(),
      correlationId,
      metadata: {
        route: "/v1/tenants",
        method: "POST",
        tenant_slug: org.slug,
        duration_ms: Date.now() - startMs,
      },
    });
    return jsonResponse(
      201,
      {
        id: org.id,
        slug: org.slug,
        status: org.status,
        created_at: org.createdAt,
      },
      correlationId,
    );
  } catch (e) {
    const code = (e as { code?: string }).code ?? "internal_error";
    const status = (e as { status?: number }).status ?? 500;
    await recordAudit(env, {
      id: newAuditId(),
      organizationId: asOrganizationId("00000000-0000-0000-0000-000000000000"),
      actorIdentityId: null,
      eventType: "tenants.create",
      outcome: "error",
      occurredAt: new Date().toISOString(),
      correlationId,
      metadata: {
        route: "/v1/tenants",
        method: "POST",
        tenant_slug: String(slug),
        duration_ms: Date.now() - startMs,
        error_code: code,
      },
    });
    if (status === 409) {
      return errorResponse(409, code, (e as Error).message, correlationId);
    }
    return errorResponse(500, "internal_error", "failed to create tenant", correlationId);
  }
}
