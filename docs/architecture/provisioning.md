# HR-mediated provisioning

Future HR integration submits a **provisioning request**, not an active account. A People Manage user may provide identity details, department, manager, start/end dates, requested applications, and requested roles/access profiles. Keys validates the input and creates a pending request.

The SysAdmin queue is the only activation path. An eligible SysAdmin compares the request against policy, narrows or approves requested access, provisions the user, and records the decision. Rejection, amendment, cancellation, suspension, and offboarding are similarly auditable. HR never receives a path to activate a user, approve its own submission, issue tokens, or grant SysAdmin-equivalent permission.

Exact HR vendor, integration protocol, attribute contract, matching rules, retries, reconciliation, and authoritative-source decision are deliberately deferred until the HR system is known. The integration must use a bounded service account, signed/authenticated calls, idempotency keys, replay protection, and a manual fallback queue.
