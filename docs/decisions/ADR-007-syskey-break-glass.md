# ADR-007: SysKey is isolated and deny-by-default

**Status:** Accepted for incubation
**Decision:** SysKey is a separately deployed Worker for narrow emergency SysAdmin access; until its independent trust path is implemented and drilled, it exposes no access route.

## Consequences

This avoids accidentally introducing a backdoor. It does not create high availability by itself. Shared Cloudflare-account, network, or identity dependencies remain a potential outage domain and must be exercised before SysKey is relied on.
