# Auditing and privacy

Audit records are append-only application events with tenant, event type, outcome, timestamp, correlation ID, and minimized metadata. They must exclude credentials, session identifiers, raw authorization headers, and prompt/output bodies by default.

Retention period, export controls, legal hold, deletion workflow, access roles, SIEM destination, and incident escalation are **TBD by accountable owners**. D1 audit tables do not make events tamper-proof or satisfy a compliance obligation by themselves.
