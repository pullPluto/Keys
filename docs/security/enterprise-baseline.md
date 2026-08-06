# Enterprise security baseline

Keys must use phishing-resistant MFA for privileged administrators, least-privilege roles, separate environments, short-lived deployment credentials, managed secret bindings, strict HTTPS-only redirects, rate limiting, WAF/abuse controls, log minimization, audit review, dependency scanning, incident response, and tested recovery.

The initial role model reserves `SysAdmin` for privileged user/app/policy administration and `People Manage` for HR-related request submission. A People Manage request is always pending until an eligible SysAdmin reviews it. Elevated access requires two-person control; an identity cannot approve its own provisioning, elevation, or application-owner change.

This baseline is a design requirement, not evidence that controls are deployed. Every production control needs configuration, an owner, a test, and ongoing review before it can be claimed effective.

The MVP (see [`../decisions/backlog/mvp.md`](../decisions/backlog/mvp.md))
implements a **bootstrap** policy.admin role sourced from
`Env.MVP_BOOTSTRAP_ADMINS` (Phase 2 issue 2.3). That bootstrap is the
only place a single identity can grant a privileged action without
two-person control, and it is removed in Phase 4 when the
role-assignment data model becomes a real product surface. Do not
copy this bootstrap into any new code path; it exists to unblock
the MVP, not to be a precedent.
