# Monitoring

The initial health endpoint is an availability signal only. Production observability must include Worker request/error rates and latency, D1 failures/latency, authorization decision failures, provider/MCP failures, audit-write failures, and deployment changes. Metrics must avoid tenant IDs, credentials, prompts, and response bodies unless an approved privacy design says otherwise.

Alert thresholds, on-call ownership, dashboards, log destination, and incident targets are **TBD**. A route that cannot write a required audit event should fail closed once audit is part of the protected operation; the health route is exempt because it has no protected action.
