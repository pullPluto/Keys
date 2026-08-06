# AI gateway

The AI gateway is an adapter boundary, not a provider implementation. A future request must establish the caller, tenant, requested model capability, and budget/policy context before a provider adapter is selected. Provider selection follows a configured allow-list and records a correlation ID.

The AI gateway is **out of scope for the MVP** (see
[`../decisions/backlog/mvp.md`](../decisions/backlog/mvp.md)). The
`packages/ai-gateway` interfaces stay as TypeScript contracts only
and no model provider, no provider credential, and no model proxying
land until a future phase opens with its own ADR. The MVP does not
introduce any cloud secret bindings, any D1 rows for model
capabilities, or any audit event type for model calls.

Initial policy requirements:

1. Authorize the model capability before creating an outbound request.
2. Never forward a caller credential to a model provider.
3. Keep provider credentials in Cloudflare secret bindings or a designated secret manager, never D1, KV, R2, source, or logs.
4. Enforce an explicit tenant/model allow-list and a bounded request size.
5. Minimize audit data; prompt/output retention needs written approval and a documented deletion path.

Quota, cost attribution, streaming, fallback, content safety, and provider-residency decisions are unimplemented. See ADR-004.
