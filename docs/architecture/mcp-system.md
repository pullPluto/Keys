# MCP policy system

MCP policy decides whether a named server/tool invocation is permitted for a scoped request. It stores neither raw tool arguments nor tool results in the decision contract; an argument digest may support correlation without default content retention.

Every server/tool pair must be allow-listed and authorized through the same tenant boundary as other actions. Tool adapters must validate schemas, apply timeouts and egress controls, prevent SSRF, and record outcome. The current repository has no MCP transport or server integration.

MCP policy is **out of scope for the MVP** (see
[`../decisions/backlog/mvp.md`](../decisions/backlog/mvp.md)). The
`packages/mcp-policy` interfaces stay as TypeScript contracts only
and no MCP server, no tool allow-list, and no MCP transport land
until a future phase opens with its own ADR. The MVP does not
introduce any new audit event type for tool calls.
