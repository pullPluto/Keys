# Keys agent instructions

## Mission and state

Keys is an incubating control plane for identity, policy enforcement, AI/agent requests, MCP permissions, and audit. Preserve the separation between domain packages and Cloudflare delivery code. Do not describe unfinished adapters or controls as production-ready.

## Required workflow

1. Read the root README and the relevant architecture, security, operations, and ADR documents before changing a boundary.
2. Apply the Frameworks sufficiency ladder: reuse platform and standard-library features before introducing a dependency or service.
3. Keep new behavior in the smallest relevant `packages/<domain>` module; keep Worker routes thin and adapter-oriented.
4. Add an ADR for any security, architecture, portability, operational, or company-default decision.
5. Keep D1 schema changes forward-only in `apps/worker/migrations/`; write a recovery note and never rewrite an applied migration.
6. Run `npm run typecheck` and `npm test` for code changes. Do not claim deployment, security review, backup restoration, or provider compatibility unless it was actually evidenced.

## Safety rules

- Never commit credentials, Cloudflare IDs, API keys, cookies, customer data, or realistic tokens.
- Treat all identity, tenant, tool, model, and policy input as untrusted at the Worker boundary.
- Do not put authorization truth in KV or R2, and do not authorize on a stale cache hit without a documented bounded-revocation design.
- Do not log bearer tokens, prompts, model responses, or raw sensitive attributes by default.
- A health endpoint must reveal no tenant, account, version, or dependency detail.
- Do not provision, deploy, delete, or mutate remote Cloudflare resources unless a user explicitly asks for that action.

## Ownership and unresolved decisions

The commissioning user is the initial accountable owner and manages Cloudflare owners. A named backup break-glass administrator, retention periods, HR vendor/contract, Cloudflare account/environment IDs, and production SLOs are still unresolved. Keep them as explicit decisions or `TBD`; do not invent values to make a configuration look complete.
