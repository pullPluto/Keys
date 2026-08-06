# Agent system

An agent invocation is a policy-governed request carrying a tenant, agent identifier, requested capabilities, and correlation ID. It is not permission to act as a human caller. A future agent adapter must derive a least-privilege capability envelope from the authenticated principal and authorize each downstream action.

Agents may not choose arbitrary models, MCP servers, tools, tenants, or credentials. Delegation, long-running jobs, human approval, memory, and background scheduling remain **TBD**; they need separate threat modeling before implementation.

The agent gateway is **out of scope for the MVP** (see
[`../decisions/backlog/mvp.md`](../decisions/backlog/mvp.md)). The
`packages/agent-gateway` interfaces stay as TypeScript contracts
only. The MVP adds no agent routes, no capability envelope logic,
and no agent audit event type.
