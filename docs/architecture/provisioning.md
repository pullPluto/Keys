# HR-mediated provisioning

Future HR integration submits a **provisioning request**, not an active account. A People Manage user may provide identity details, department, manager, start/end dates, requested applications, and requested roles/access profiles. Keys validates the input and creates a pending request.

HR-mediated provisioning is **out of scope for the MVP** (see
[`../decisions/backlog/mvp.md`](../decisions/backlog/mvp.md)). The
`provisioning_requests` table exists in D1 migration `0002` so the
data model is in place, but no route, no HR adapter, no SysAdmin
queue UI, and no People Manage role ship until a future phase opens
with its own ADR. Until then, the only way to create a `user`,
`role`, or `user_role_assignment` row is a direct, audited database
write by a developer — not a public route.

The SysAdmin queue is the only activation path. An eligible SysAdmin compares the request against policy, narrows or approves requested access, provisions the user, and records the decision. Rejection, amendment, cancellation, suspension, and offboarding are similarly auditable. HR never receives a path to activate a user, approve its own submission, issue tokens, or grant SysAdmin-equivalent permission.

Exact HR vendor, integration protocol, attribute contract, matching rules, retries, reconciliation, and authoritative-source decision are deliberately deferred until the HR system is known. The integration must use a bounded service account, signed/authenticated calls, idempotency keys, replay protection, and a manual fallback queue.
