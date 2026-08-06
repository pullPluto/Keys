// packages/audit/src/index.ts
//
// Audit sink with metadata allowlist. The MVP writes one row per
// protected call. Anything not on the allowlist is dropped before
// write; the warning is logged at info level with no payload content.
//
// ADR-011: the allowlist is the only mechanism controlling what
// metadata is persisted. The Phase 4 retention decision (issue #23)
// will set the lifecycle; until then, audit rows live in D1.

import type { D1Database, D1PreparedStatement } from "../../identity/src/d1";

export type AuditOutcome = "allowed" | "denied" | "error";

/** The MVP allowlist. Adding a key here is a privileged change;
 *  every entry must be justified in the corresponding code path.
 *  Phase 4 retention may narrow this further. */
export const metadataAllowlist: ReadonlySet<string> = new Set([
  // Identity
  "tenant_slug",
  "identity_id",
  "provider",
  // Auth
  "auth_principal_id",
  "auth_failure_reason",
  // Policy
  "policy_id",
  "policy_version",
  "policy_admin_id",
  "policy_action",
  "policy_resource",
  // Authorize
  "authorize_action",
  "authorize_resource",
  "authorize_decision",
  "authorize_reason_code",
  // Operational
  "route",
  "method",
  "duration_ms",
  "error_code",
  "error_message",
]);

export interface AuditEvent {
  id: string;
  organizationId: string;
  actorIdentityId: string | null;
  eventType: string;
  outcome: AuditOutcome;
  occurredAt: string;
  correlationId: string;
  metadata: Readonly<Record<string, string | number | boolean>>;
}

export interface AuditSink {
  append(event: AuditEvent): Promise<void>;
}

/** A no-op sink used by tests and the bootstrap before the real
 *  D1 sink is wired. */
export class NullAuditSink implements AuditSink {
  async append(_event: AuditEvent): Promise<void> {
    // intentionally empty
  }
}

/** A sink that records every event in memory. Used by tests. */
export class InMemoryAuditSink implements AuditSink {
  readonly events: AuditEvent[] = [];
  async append(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }
  clear(): void {
    this.events.length = 0;
  }
}

/** Filter the metadata object against the allowlist. Disallowed
 *  keys are dropped. Returns a new object; the input is untouched. */
export function filterMetadata(
  metadata: Readonly<Record<string, unknown>>,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (!metadataAllowlist.has(k)) continue;
    if (v === null || v === undefined) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    } else {
      // Stringify complex values to keep the column type simple. This
      // is the only coercion; callers should keep metadata primitive.
      out[k] = JSON.stringify(v);
    }
  }
  return out;
}

export class D1AuditSink implements AuditSink {
  constructor(
    private readonly db: D1Database,
    private readonly newId: () => string,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}
  async append(event: AuditEvent): Promise<void> {
    const filtered = filterMetadata(event.metadata);
    const stmt: D1PreparedStatement = this.db
      .prepare(
        "INSERT INTO audit_events (id, organization_id, actor_identity_id, event_type, outcome, occurred_at, correlation_id, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        event.id,
        event.organizationId,
        event.actorIdentityId,
        event.eventType,
        event.outcome,
        event.occurredAt,
        event.correlationId,
        JSON.stringify(filtered),
      );
    await stmt.run();
  }
}

/** Convenience: build the metadata for a route call. The allowlist
 *  is enforced at append time, so callers can be liberal here. */
export function routeMetadata(input: {
  route: string;
  method: string;
  durationMs?: number;
  policyVersion?: number;
  decision?: "allow" | "deny";
  reasonCode?: string;
  errorCode?: string;
  errorMessage?: string;
}): Record<string, string | number | boolean> {
  const m: Record<string, string | number | boolean> = {
    route: input.route,
    method: input.method,
  };
  if (input.durationMs !== undefined) m.duration_ms = input.durationMs;
  if (input.policyVersion !== undefined) m.policy_version = input.policyVersion;
  if (input.decision) m.authorize_decision = input.decision;
  if (input.reasonCode) m.authorize_reason_code = input.reasonCode;
  if (input.errorCode) m.error_code = input.errorCode;
  if (input.errorMessage) m.error_message = input.errorMessage;
  return m;
}
