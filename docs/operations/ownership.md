# Ownership and Cloudflare administration

The commissioning user is the initial accountable owner for Keys and manages Cloudflare ownership. This centralizes early accountability but is not sufficient resilience for a company identity system.

Before production, establish: a named backup break-glass administrator, least-privilege Cloudflare roles, hardware-backed MFA for privileged accounts, separate deployment and emergency-recovery identities, access-review cadence, owner transfer procedure, and a record of who may approve a SysKey activation. Keys must enforce segregation of duties even if one person initially holds multiple responsibilities.

The backup break-glass administrator is tracked as Phase 4 issue 4.1
in [`../decisions/backlog/mvp.md`](../decisions/backlog/mvp.md), which
names the ADR to be created (`ADR-012-backup-breakglass.md`) in the
same PR as the decision. Until that ADR is merged, the backup slot
is `TBD`; do not invent a name to make a configuration look complete.
