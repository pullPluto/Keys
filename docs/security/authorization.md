# Authorization requirements

Enforce authorization server-side for every tenant-scoped read or action. Default deny; avoid wildcard permissions; include tenant ID in every durable lookup; and use stable machine reason codes without exposing policy internals. Administrative policy changes require a separate privileged action and an audit trail.

Policy caching requires a documented maximum staleness, negative-cache behavior, revocation propagation, and an operational purge path before it is enabled. KV is never sufficient as the only authorization store.

The MVP (see [`../decisions/backlog/mvp.md`](../decisions/backlog/mvp.md))
introduces a bounded-revocation KV cache opt-in for
`POST /v1/authorize` (Phase 2 issue 2.4) with a TTL ≤ 5 s and a
hard cap. The cache is enabled only when `Env.AUTHORIZATION_CACHE`
is set, and the AGENTS.md safety rule "no authz on a stale cache
hit without a documented bounded-revocation design" is met by the
5 s window plus an in-D1 policy version bump on every activation.
The TTL and the cap are MVP defaults, not a long-term design;
before production, the bounded-revocation design must be captured
in an ADR.
