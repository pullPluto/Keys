// apps/worker/src/routes/audit.ts
//
// Shared audit emitter for Worker routes. The MVP writes one row
// per protected call. Anything not on the allowlist is dropped
// at the sink (see packages/audit/src/index.ts).

import type { AuditEvent, AuditSink } from "../../../../packages/audit/src";
import { D1AuditSink } from "../../../../packages/audit/src";
import { defaultIdGenerator } from "../../../../packages/identity/src";
import type { Env } from "../env";

/** Resolve the audit sink for an Env. Tests may set a global
 *  override; production always uses the D1 sink. */
let overrideSink: AuditSink | null = null;
export function setAuditSink(sink: AuditSink | null): void {
  overrideSink = sink;
}
export function getAuditSink(env: Env): AuditSink {
  if (overrideSink) return overrideSink;
  return new D1AuditSink(env.KEYS_DB, defaultIdGenerator);
}

/** Record an audit event. Failures to write the audit event fail
 *  the originating request closed (or 500), per the M3.2 acceptance
 *  criterion. */
export async function recordAudit(env: Env, event: AuditEvent): Promise<void> {
  const sink = getAuditSink(env);
  await sink.append(event);
}

/** Construct an audit event for a route call. Helpers like
 *  `withRouteAudit` below wrap the pattern. */
export function buildRouteAuditEvent(input: {
  organizationId: string;
  actorIdentityId: string | null;
  eventType: string;
  outcome: "allowed" | "denied" | "error";
  correlationId: string;
  metadata: AuditEvent["metadata"];
  occurredAt?: string;
  newId?: () => string;
}): AuditEvent {
  return {
    id: (input.newId ?? defaultIdGenerator)(),
    organizationId: input.organizationId,
    actorIdentityId: input.actorIdentityId,
    eventType: input.eventType,
    outcome: input.outcome,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    correlationId: input.correlationId,
    metadata: input.metadata,
  };
}
