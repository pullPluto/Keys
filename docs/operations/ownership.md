# Ownership and Cloudflare administration

The commissioning user is the initial accountable owner for Keys and manages Cloudflare ownership. This centralizes early accountability but is not sufficient resilience for a company identity system.

Before production, establish: a named backup break-glass administrator, least-privilege Cloudflare roles, hardware-backed MFA for privileged accounts, separate deployment and emergency-recovery identities, access-review cadence, owner transfer procedure, and a record of who may approve a SysKey activation. Keys must enforce segregation of duties even if one person initially holds multiple responsibilities.
