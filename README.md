# Keys

Keys is PullPluto's planned company identity provider, authorization system, and policy-control-plane foundation. Its destination is a controlled replacement for Authentik across company tools, with AI/agent and MCP policy capabilities added after core identity is dependable. It is implemented as Cloudflare Workers with deliberately separated domain packages, so authentication, authorization, model routing, MCP policy, and audit records can evolve without becoming one undifferentiated service.

This repository is **incubating**. It supplies a safe foundation and a working health endpoint; it does not yet claim to replace an identity provider, issue production tokens, or proxy model traffic.

## Repository map

```text
apps/worker/                 Deployable Cloudflare Worker and D1 migrations
apps/syskey/                 Isolated SysAdmin break-glass Worker foundation
packages/                    Domain contracts and policy primitives
docs/architecture/           Boundaries, trust model, and flows
docs/security/               Security requirements and non-goals
docs/operations/             Deployment, recovery, and observability runbooks
docs/decisions/              Architecture decision records
infrastructure/cloudflare/   Binding template and resource inventory
infrastructure/scripts/      Explicit, operator-run provisioning commands
tests/                       Repository-level checks
```

## Current capability

- `GET /healthz` returns a non-sensitive service status.
- The Worker binds D1, KV, and R2 under the `keys-pluto` resource name.
- The initial D1 migration creates tenant, identity, client, policy, and append-only audit foundations.
- Domain modules define interfaces only; network protocols and external providers remain behind adapters.
- A planned universal application registry, HR-mediated provisioning queue, and SysAdmin approval boundary are recorded but not exposed as public routes.

## Local development

Prerequisites: Node.js 22+ and an authenticated Cloudflare Wrangler session for remote development or deployment.

```sh
npm install
npm run typecheck
npm test
npm run dev
```

Copy `apps/worker/wrangler.example.jsonc` to `apps/worker/wrangler.jsonc`, then replace only the deliberately invalid binding identifiers. Do not commit the copied file, account IDs, tokens, or secrets. See [Cloudflare infrastructure](infrastructure/cloudflare/README.md).

## Important boundaries

- D1 is the durable control-plane record; KV is disposable acceleration and R2 is artifact retention, never a source of authorization truth.
- Authentication is not authorization. Every action must be authorized against a current policy decision.
- The AI and agent gateways must enforce tenant, subject, capability, model/tool, and budget policy before any provider call.
- Audit events are append-only application records. They are not a substitute for Cloudflare account audit logs or a SIEM.
- Resource names are fixed to `keys-pluto`; Cloudflare-generated IDs and production account settings are intentionally not committed.

## Documentation

Start with the [replacement program](docs/product/replacement-program.md), then read [architecture overview](docs/architecture/overview.md), [application registry](docs/architecture/application-registry.md), [provisioning](docs/architecture/provisioning.md), [SysKey boundary](docs/architecture/syskey-fallback.md), and [security requirements](docs/security/authentication.md). Material choices are recorded in [ADRs](docs/decisions/).

## Status and delivery gates

The user has designated themselves as initial accountable owner and Cloudflare owner manager. Before the first production deployment, they must still name a break-glass backup administrator and approve the threat model, data classification, retention periods, incident response, provider contracts, recovery exercise, and deployment environment. These are intentionally marked as unresolved where evidence is not yet present.
