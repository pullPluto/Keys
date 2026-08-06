# Keys agent instructions

## Mission and state

Keys is an incubating control plane for identity, policy enforcement, AI/agent requests, MCP permissions, and audit. Preserve the separation between domain packages and Cloudflare delivery code. Do not describe unfinished adapters or controls as production-ready.

The first deliverable is the **MVP** defined in
[`docs/decisions/backlog/mvp.md`](docs/decisions/backlog/mvp.md). Everything
in that backlog is in scope; everything else is out of scope until its
phase is reached or a new ADR opens it. The MVP is the smallest set of
changes that turns the current scaffold into a real, exercised identity
+ authorization + audit loop on D1, with dev/staging-only credentials
and no production deployment.

## Required workflow

1. Read the root README and the relevant architecture, security, operations, and ADR documents before changing a boundary. If the change is part of the MVP, also read the corresponding issue in
   [`docs/decisions/backlog/mvp.md`](docs/decisions/backlog/mvp.md) and obey its acceptance criteria.
2. Apply the Frameworks sufficiency ladder: reuse platform and standard-library features before introducing a dependency or service.
3. Keep new behavior in the smallest relevant `packages/<domain>` module; keep Worker routes thin and adapter-oriented.
4. Add an ADR for any security, architecture, portability, operational, or company-default decision. The MVP backlog lists which issues require an ADR; do not skip them.
5. Keep D1 schema changes forward-only in `apps/worker/migrations/`; write a recovery note and never rewrite an applied migration. Migrations must not be added without a corresponding issue in the MVP backlog or a new ADR opening a future phase.
6. Run `npm run typecheck` and `npm test` for code changes. Do not claim deployment, security review, backup restoration, or provider compatibility unless it was actually evidenced.
7. Keep issues small: 1–3 days of work, ≤ 5 story points. If an issue exceeds 5 points, split it before opening a PR; the MVP backlog already does this for the end-to-end test and the threat-model work.

## Safety rules

- Never commit credentials, Cloudflare IDs, API keys, cookies, customer data, or realistic tokens.
- Treat all identity, tenant, tool, model, and policy input as untrusted at the Worker boundary.
- Do not put authorization truth in KV or R2, and do not authorize on a stale cache hit without a documented bounded-revocation design.
- Do not log bearer tokens, prompts, model responses, or raw sensitive attributes by default.
- A health endpoint must reveal no tenant, account, version, or dependency detail.
- Do not provision, deploy, delete, or mutate remote Cloudflare resources unless a user explicitly asks for that action.

## Ownership and unresolved decisions

The commissioning user is the initial accountable owner and manages Cloudflare owners. A named backup break-glass administrator, retention periods, HR vendor/contract, Cloudflare account/environment IDs, and production SLOs are still unresolved. Keep them as explicit decisions or `TBD`; do not invent values to make a configuration look complete.

Each unresolved gate is tracked as a Phase 4 issue in
[`docs/decisions/backlog/mvp.md`](docs/decisions/backlog/mvp.md). Closing
a gate requires the corresponding ADR to be merged; landing the code
without the ADR is not a substitute.
