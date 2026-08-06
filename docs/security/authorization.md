# Authorization requirements

Enforce authorization server-side for every tenant-scoped read or action. Default deny; avoid wildcard permissions; include tenant ID in every durable lookup; and use stable machine reason codes without exposing policy internals. Administrative policy changes require a separate privileged action and an audit trail.

Policy caching requires a documented maximum staleness, negative-cache behavior, revocation propagation, and an operational purge path before it is enabled. KV is never sufficient as the only authorization store.
