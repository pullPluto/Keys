# Data flow

```text
1. Request arrives at the Worker
2. Route validates method, path, content type, and bounded input
3. Authentication adapter verifies credential and resolves enabled tenant identity
4. Authorization engine decides against the active policy
5. Authorized adapter calls only an allowed model, agent, or MCP target
6. Audit sink records minimized outcome with correlation ID
7. Response returns with no secret, provider, or tenant internal detail
```

Steps 3–6 are the target flow. The MVP (see
[`../decisions/backlog/mvp.md`](../decisions/backlog/mvp.md)) makes
steps 2–4 and step 6 real for the tenant, identity, and authorize
routes; steps 5 and 7 are exercised by the end-to-end test. Steps 3–6
remain out of scope for any model/agent/MCP call until the relevant
Phase 4+ adapter lands.

Any failure at a trust boundary is denied, logged with minimized
diagnostics, and returned as a generic client-safe error. The health
route intentionally bypasses this flow because it performs no tenant
action and returns no dependency detail. The MVP adds a
`/healthz`-leakage test (Phase 3 issue 3.4) that pins the allowed
response keys.
