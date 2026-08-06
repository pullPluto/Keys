# Auditing and privacy

Audit records are append-only application events with tenant, event type, outcome, timestamp, correlation ID, and minimized metadata. They must exclude credentials, session identifiers, raw authorization headers, and prompt/output bodies by default.

The MVP introduces an explicit metadata allowlist. The allowlist, and
the redaction behavior that drops anything not on it, are tracked as
issue 3.1 in [`../decisions/backlog/mvp.md`](../decisions/backlog/mvp.md),
which names the ADR to be created (`ADR-011-audit-redaction.md`) in
the same PR as the code change. The MVP envelope returns an
`AuditSink` that fails closed if the allowlist is violated at write
time.

Retention period, export controls, legal hold, deletion workflow, access roles, SIEM destination, and incident escalation are **TBD by accountable owners** and tracked as Phase 4 issues 4.2 (retention) and 4.3d (incident response). D1 audit tables do not make events tamper-proof or satisfy a compliance obligation by themselves.

A future per-app identity mapping layer (see
[issue M4.9 / ADR-015](../decisions/backlog/mvp.md#decision-adr-required-per-app-identity-mapping-for-cross-tool-user-references))
will introduce its own audit event type for handle resolution and
field-shaped reads; that event type is defined inside the ADR, not
in this document, so the allowlist can evolve with the design.
