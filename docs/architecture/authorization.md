# Authorization

Authorization receives an organization-scoped subject, action, resource, and a small allow-listed context. It returns `allow` or `deny`, a policy version, and a stable reason code. Missing, malformed, inactive, cross-tenant, or stale information must fail closed.

Policy documents are versioned and activated explicitly. The active-policy selection algorithm, policy language, administrator authorization, and cache/revocation window are **TBD** and must be approved before a route relies on them. An audit event must record the outcome, policy version, correlation ID, and minimized metadata; it must not capture raw credentials or prompt content by default.

RBAC can be expressed as a policy input; attribute and relationship rules must not bypass the same decision interface. Direct role checks in delivery routes are prohibited once this module is active.
