# Keys MVP — Phase-by-Phase Issue Backlog

**Owner:** commissioning user (initial accountable owner)
**Status:** proposed; not yet committed
**Companion to:** `README.md`, `AGENTS.md`, `docs/architecture/overview.md`,
`docs/security/`, `docs/operations/`, `docs/integrations/`

This document is the first increment of work after the foundation commit
(`acda5f1`) and the Mission Control boundary commit (`c91c9f9`). It is the
*proposed* MVP for Keys: the smallest set of changes that turns the current
scaffold into a real, exercised control plane for **internal** identity and
authorization, while keeping every AGENTS.md boundary intact.

Every cross-document dependency is captured in this file. Each issue that
requires an ADR points at the cross-doc sections it must update, and each
out-of-scope area (OIDC, the application registry, HR provisioning, the
AI/agent/MCP gateways, SysKey activation, email) calls out which future
phase opens it.

The backlog is intentionally narrow. It does **not** include OIDC issuance,
WebAuthn, TOTP, the AI/agent/MCP gateways, the universal application registry,
HR-driven provisioning, or SysKey break-glass behavior. Those are later
phases (Phase 4+) and each gets its own ADR-driven increment.

## Relationship to the replacement program

The replacement program in
[`docs/product/replacement-program.md`](../../product/replacement-program.md)
defines 11 long-term milestones (0–10). The MVP phases here align as
follows:

| MVP phase | Replacement-program milestone | Notes |
| --- | --- | --- |
| M0 — MVP Foundations | 0 (Governance) + 1 (Secure platform) | Adds the migration runner, request envelope, and test harness. The replacement-program's milestone 0 inventory and milestone 1 environments are tracked separately as Phase 4 work and are out of MVP scope. |
| M1 — Identity MVP | 2 (Core directory) | First slice: tenant, identity, dev verifier. Universal application registry, full user/role model, and HR provisioning stay in later replacement-program milestones. |
| M2 — Authz MVP | 2 (Core directory) | First slice: policy upload, activation, default-deny authorize route. |
| M3 — Audit & Hardening | 2 (Core directory) | First slice: audit allowlist, wire emit, end-to-end test, health-leakage test. |
| M4 — Production Gates | 1, 3, 4, 5, 8, 10 | Decision-only work. Closes the production gates that AGENTS.md and README still list as `TBD`. |

The MVP does not claim completion of any replacement-program milestone.
Each replacement-program milestone has its own exit evidence; the MVP
satisfies only the **first slice** of milestones 1 and 2.

## What "MVP" means here

A reviewer can:

1. Apply the migrations to a fresh D1 (`keys-pluto`) database.
2. Boot the Worker locally with `npm run dev` and hit `GET /healthz`.
3. `POST /v1/tenants` to register a tenant (single-tenant, dev-grade path).
4. `POST /v1/identities` to register one external identity link.
5. `POST /v1/auth/verify` with a signed dev credential and receive a verified
   principal.
6. `POST /v1/authorize` and receive a `deny` until a draft policy is activated,
   then an `allow` referencing a `policy_version`.
7. Query `GET /v1/audit?since=...` and see normalized events with no
   sensitive payload retention.
8. Read every line that touched the request and find it in `packages/*` —
   the Worker route handlers are adapter shells only.

That is the exit criteria for Phase 3. Everything before it is wiring.

## Out of scope (explicitly)

These are tracked elsewhere; none of them ships in the MVP:

- OIDC / OAuth client_credentials issuance — replacement-program milestone 4.
- WebAuthn, TOTP, password storage, magic links — replacement-program milestone 5.
- Universal application registry and protocol selection — replacement-program milestone 6.
- HR-mediated provisioning queue — replacement-program milestone 3.
- AI gateway, agent gateway, MCP policy — replacement-program milestone 10.
- Production tenancy, backup/restore, SLOs, retention period approval — Phase 4 of this backlog.
- SysKey break-glass activation flows — replacement-program milestone 8.
- Any deployment beyond `wrangler dev` against a personal sandbox account — Phase 4 issue 4.5.
- Transactional email — recorded in `docs/operations/email.md`; not opened by any issue in this backlog.

## Conventions for the issues in this backlog

- Labels: `mvp`, `backend`, `domain`, `database`, `security`, `docs`,
  `testing`, `infrastructure`, `adr-required`.
- Milestone: `M0 — MVP Foundations`, `M1 — Identity MVP`,
  `M2 — Authz MVP`, `M3 — Audit & Hardening`, `M4 — Production Gates`.
- Story points: 1, 2, 3, or 5 (Fibonacci).
- Every issue names the file(s) it will create or modify.
- Every issue with `adr-required` must land an ADR in `docs/decisions/`
  in the same PR, and must update every cross-doc link in this file's
  "Cross-doc updates" callout below.
- No issue is larger than 5 story points. If something feels like a 5,
  the next pass splits it.

## Cross-doc updates required by issues in this backlog

The MVP touches 15 documentation files. Every PR that lands an MVP
issue must keep these files consistent. The backlog issues point at
the lines below when an issue specifically owns a section.

| Doc | What changes | Owned by issue |
| --- | --- | --- |
| `AGENTS.md` | MVP scope note; new workflow rule (issues ≤ 5 pts); gate list points at Phase 4 | this file (PR-time) |
| `README.md` | New "MVP definition" section; documentation index; gate list | this file (PR-time) |
| `docs/architecture/overview.md` | Purpose + Non-goals reference this backlog | this file (PR-time) |
| `docs/architecture/data-flow.md` | Steps 2–4, 6 made real; health-leakage test | 3.4 |
| `docs/architecture/identity-model.md` | Tenant + identity data model exercised; per-app identity mapping ADR cross-link | 1.1, 1.2, 4.9 |
| `docs/architecture/authorization.md` | Bootstrap chicken-and-egg removed; bounded-revocation design for the cache | 2.3, 2.4, 4.4 |
| `docs/architecture/application-registry.md` | Out-of-MVP notice; per-app `users.read` capability and `allowed_user_fields` design (after 4.9 ADR) | this file (PR-time), 4.9 |
| `docs/architecture/provisioning.md` | Out-of-MVP notice | this file (PR-time) |
| `docs/architecture/syskey-fallback.md` | Out-of-MVP notice | this file (PR-time) |
| `docs/architecture/ai-gateway.md` | Out-of-MVP notice | this file (PR-time) |
| `docs/architecture/agent-system.md` | Out-of-MVP notice | this file (PR-time) |
| `docs/architecture/mcp-system.md` | Out-of-MVP notice | this file (PR-time) |
| `docs/security/authentication.md` | Dev verifier + prod gate | [M1.4](https://github.com/pullPluto/Keys/issues/10), [M4.7](https://github.com/pullPluto/Keys/issues/28) |
| `docs/security/authorization.md` | Bounded-revocation note for the cache | 2.4 |
| `docs/security/auditing.md` | Allowlist referenced; retention owned; per-app mapping audit events (after 4.9 ADR) | 3.1, 4.2, 4.9 |
| `docs/security/encryption.md` | No new crypto in MVP | this file (PR-time) |
| `docs/security/threat-detection.md` | Threat model work split | 4.3a–4.3d |
| `docs/security/enterprise-baseline.md` | Bootstrap admin caveat | 2.3 |
| `docs/operations/ownership.md` | Backup break-glass admin ADR | 4.1 |
| `docs/operations/deployment.md` | Dev/staging-only enforcement; environment gate | 0.1, 4.5 |
| `docs/operations/backups.md` | Recovery exercise tracked | 0.1, 4.2, 4.3d |
| `docs/operations/monitoring.md` | Audit failure → 500 | 3.2 |
| `docs/operations/email.md` | Out-of-MVP notice | this file (PR-time) |
| `docs/integrations/mission-control.md` | Out-of-MVP notice | this file (PR-time) |

## Phase 0 — MVP Foundations (M0)

> Goal: stop the scaffold from being only a health endpoint. Add a
> real route surface, a shared test harness, and the migration runner
> shape. No new domain behavior yet.

Exit criteria: `npm run typecheck` and `npm test` pass; a second route
exists in the Worker; the migration runner is wired through Wrangler;
`AGENTS.md` and `README.md` reference this backlog.

### [Infra] Wire D1 migration runner and seed bootstrap

- **Labels:** infrastructure, backend, mvp
- **Milestone:** M0 — MVP Foundations
- **Story Points:** 5
- **Description:** Today the SQL files in `apps/worker/migrations/` exist but
  there is no documented, repeatable way to apply them. We need a local
  D1 bootstrap that `npm test` and `wrangler dev` can both rely on, and
  a recovery note for the first applied migration.
- **Acceptance Criteria:**
  - [ ] `infrastructure/scripts/apply-migrations.sh` (or equivalent
        Wrangler config) applies `0001_*.sql` and `0002_*.sql` in order
        against a target D1 database named via env var.
  - [ ] A short `docs/operations/backups.md` addendum records how to
        inspect the migration table after apply.
  - [ ] CI script (or local `npm run check:migrations`) verifies every
        migration has a forward-only forward step (no DROP/ALTER of an
        already-applied column without a new migration).
  - [ ] `README.md` updated with the apply command (dev only).
  - [ ] `docs/operations/deployment.md` Operator sequence step 3
        references the same script.
- **Technical Notes:**
  - Prefer `wrangler d1 migrations apply` if the local Wrangler version
    supports it (4.119.0 should); otherwise shell out to a documented
    `wrangler d1 execute` loop.
  - Do not invent Cloudflare account IDs or database IDs; the script
    must read them from a local, gitignored `wrangler.jsonc`.
  - Add a `recovery_note` field to the migration journal via a D1
    metadata table or a sibling file under
    `apps/worker/migrations/notes/`.
- **Dependencies:** none.

<details>
<summary>Boilerplate Code</summary>

```text
infrastructure/scripts/apply-migrations.sh
  - shellcheck-clean
  - reads WRANGLER_DB_NAME + KEYS_PLUTO_DB_ID from env
  - iterates apps/worker/migrations/*.sql in lexical order
  - aborts on first failure with a non-zero exit

apps/worker/wrangler.example.jsonc
  - add a [[d1_databases]] entry bound as KEYS_DB (id placeholder)

tests/migration-shape.test.ts
  - scans migrations/*.sql
  - asserts no file contains "DROP COLUMN" / "RENAME COLUMN"
  - asserts every file ends with a trailing newline

apps/worker/migrations/notes/0001_control_plane.recovery.md
  - empty-placeholder note (or D1 metadata row) that names the
    recovery contact as TBD and points at this backlog
```

</details>

### [Backend] Add request envelope and shared error response shape

- **Labels:** backend, mvp
- **Milestone:** M0 — MVP Foundations
- **Story Points:** 3
- **Description:** Every future route will need a request envelope that
  parses JSON, validates the org slug, and emits a normalized error
  response. Centralize it now so Phase 1+ routes only have to
  declare their own input schema on top.
- **Acceptance Criteria:**
  - [ ] `apps/worker/src/http/envelope.ts` exposes
        `parseJsonRequest<T>(request, schema)` and `errorResponse(...)`.
  - [ ] Error responses use the contract from
        `docs/security/auditing.md` (no sensitive payload leakage,
        correlation id on every response).
  - [ ] `tests/http-envelope.test.ts` covers: malformed JSON, missing
        content-type, oversized body, schema mismatch, correlation id
        propagation.
  - [ ] `/healthz` is unchanged but routed through the new envelope's
        content-type helper so it stays byte-identical to the existing
        test assertion.
  - [ ] When `ENVIRONMENT === "production"`, the envelope returns
        `501` for any non-health route. This is the dev/staging-only
        gate referenced in `docs/operations/deployment.md`.
- **Technical Notes:**
  - Use the platform `Request`/`Response` only; do **not** introduce
    a router framework yet (sufficiency ladder).
  - Keep envelope dependency-free; validation can be a tiny hand-rolled
    schema until Phase 4 when something heavier is justified by an ADR.
- **Dependencies:** M0.1 [#3](https://github.com/pullPluto/Keys/issues/3) (migration runner) — non-blocking
  but recommended first.

<details>
<summary>Boilerplate Code</summary>

```ts
// apps/worker/src/http/envelope.ts
export interface EnvelopeOptions<T> {
  schema: (input: unknown) => T;
  maxBytes?: number;
}

export async function parseJsonRequest<T>(
  request: Request,
  options: EnvelopeOptions<T>,
): Promise<{ ok: true; value: T; correlationId: string } | { ok: false; response: Response }> {
  // ...
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  correlationId: string,
): Response { /* ... */ }

export function isProduction(env: { ENVIRONMENT: string }): boolean {
  return env.ENVIRONMENT === "production";
}
```

</details>

### [Docs] Record the MVP definition in a decision record

- **Labels:** docs, adr-required
- **Milestone:** M0 — MVP Foundations
- **Story Points:** 2
- **Description:** Capture the MVP definition in
  `docs/decisions/ADR-009-mvp-definition.md` so future contributors can
  challenge scope without re-litigating the conversation.
- **Acceptance Criteria:**
  - [ ] ADR states: in-scope, out-of-scope, success exit criteria.
  - [ ] ADR references this backlog file.
  - [ ] ADR is cross-linked from `README.md` and
        `docs/architecture/overview.md`.
- **Technical Notes:** Mirror the template of `ADR-001-single-worker.md`.
- **Dependencies:** none (can land in parallel with the code issues).

### [Testing] Add Worker route harness and CI-equivalent check script

- **Labels:** testing, infrastructure, mvp
- **Milestone:** M0 — MVP Foundations
- **Story Points:** 3
- **Description:** Today `tests/health.test.ts` imports the route module
  directly. Once the Worker depends on `Env`, we need a fake `Env`
  builder so route tests can exercise real handlers without Cloudflare.
- **Acceptance Criteria:**
  - [ ] `tests/_support/env.ts` exports a `createTestEnv(overrides?)`
        helper that returns a structurally complete `Env` with in-memory
        KV, an in-memory D1 stub, and a memory-only R2 stub.
  - [ ] `package.json` `test` script remains `node --import tsx --test
        tests/*.test.ts` and exercises at least one route through
        `createTestEnv`.
  - [ ] README "Local development" section is updated to call out the
        test harness and the fact that no real Cloudflare credentials
        are required to run the suite.
- **Technical Notes:** The D1 stub needs to support `prepare(query).bind(...).first()` /
  `.all()` / `.run()` at minimum; KV and R2 can be `Map`-backed. No
  dependency on `better-sqlite3` unless an ADR justifies it.
- **Dependencies:** M0.2 [#4](https://github.com/pullPluto/Keys/issues/4) (envelope).

## Phase 1 — Identity MVP (M1)

> Goal: a tenant, an external identity link, and a credential verifier
> are real and exercised through the Worker.

Exit criteria: the Phase 0 envelope plus a working `POST /v1/tenants`,
`POST /v1/identities`, and a `POST /v1/auth/verify` that returns a
verified principal. The credential verifier is a dev-only stub
(declared `unsafe-for-production` via env flag) until Phase 4.

### [Domain] Add tenant use-cases in `packages/identity`

- **Labels:** domain, backend, mvp
- **Milestone:** M1 — Identity MVP
- **Story Points:** 3
- **Description:** Today `packages/identity` defines `Identity` and
  `IdentityRepository` only. Add the `Organization` aggregate and a
  `TenantService` interface so the Worker can depend on a domain
  contract, not raw SQL.
- **Acceptance Criteria:**
  - [ ] `Organization`, `OrganizationRepository`, and `TenantService`
        exported from `packages/identity/src/index.ts`.
  - [ ] `TenantService.createDraft(input)` returns `{ id, slug }` and
        enforces slug uniqueness at the contract level (the SQL
        constraint remains the source of truth).
  - [ ] New unit test file `packages/identity/test/tenant.test.ts`
        uses an in-memory fake repository.
  - [ ] `docs/architecture/identity-model.md` is updated to mention
        that the MVP exercises the `Organization` aggregate end to end.
- **Technical Notes:** Stay platform-agnostic. No Cloudflare types in
  the package.
- **Dependencies:** M0.3 [#5](https://github.com/pullPluto/Keys/issues/5) (ADR-009).

<details>
<summary>Boilerplate Code</summary>

```ts
// packages/identity/src/index.ts (additions)
export interface Organization {
  id: OrganizationId;
  slug: string;
  status: "active" | "suspended";
  createdAt: Date;
}

export interface OrganizationRepository {
  findBySlug(slug: string): Promise<Organization | null>;
  insert(org: Organization): Promise<void>;
}

export interface TenantService {
  createDraft(input: { slug: string; createdBy: IdentityId }): Promise<Organization>;
}
```

</details>

### [Database] D1 repository implementation for identity package

- **Labels:** database, backend, mvp
- **Milestone:** M1 — Identity MVP
- **Story Points:** 5
- **Description:** Implement `OrganizationRepository` and
  `IdentityRepository` against D1. This is the *only* place SQL is
  written; the Worker route must depend on the interface, not this
  class.
- **Acceptance Criteria:**
  - [ ] `packages/identity/src/d1/` contains the concrete
        implementations, exported via `createD1Repositories(env)`.
  - [ ] `tests/identity-d1.test.ts` round-trips a tenant + identity
        through the in-memory D1 stub.
  - [ ] No Cloudflare-specific types are re-exported from the package
        root.
- **Technical Notes:** D1 is SQLite; use `INSERT ... ON CONFLICT DO
  NOTHING` to make replays idempotent. Bind every value, never
  interpolate.
- **Dependencies:** M1.1 [#7](https://github.com/pullPluto/Keys/issues/7); M0.4 [#6](https://github.com/pullPluto/Keys/issues/6) (env test harness).

### [Backend] `POST /v1/tenants` and `POST /v1/identities` Worker routes

- **Labels:** backend, security, mvp
- **Milestone:** M1 — Identity MVP
- **Story Points:** 5
- **Description:** Two thin Worker routes that translate HTTP into
  `TenantService` / `IdentityRepository` calls. These are the first
  non-health endpoints; they prove the route + envelope + domain shape
  works end to end.
- **Acceptance Criteria:**
  - [ ] Routes are registered in `apps/worker/src/index.ts` next to
        the existing `/healthz` branch.
  - [ ] Both routes return `501` if `ENVIRONMENT === "production"`
        (MVP is dev/staging only; enforced in the envelope, see 0.2).
  - [ ] Every successful and failed call emits an `audit_event` row
        (see 3.1 / 3.2) — write a TODO marker so the audit emit lands
        in Phase 3.
  - [ ] Tests in `tests/identity-routes.test.ts` cover happy path,
        duplicate slug (409), bad JSON (400), and prod environment
        rejection.
- **Technical Notes:** Validate the slug against a strict regex
  (`^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$`) and reject reserved slugs
  (`admin`, `system`, `syskey`, `keys`).
- **Dependencies:** M1.1 [#7](https://github.com/pullPluto/Keys/issues/7), M1.2 [#8](https://github.com/pullPluto/Keys/issues/8).

### [Security, adr-required] Dev-only credential verifier contract

- **Labels:** security, adr-required, mvp
- **Milestone:** M1 — Identity MVP
- **Story Points:** 5
- **Description:** Define a `CredentialVerifier` for the MVP. The
  implementation is an HMAC-SHA256 stub keyed by a dev secret. The
  stub must be refused at the Worker boundary when
  `ENVIRONMENT === "production"` and an ADR must justify why the
  stub is acceptable in dev/staging only.
- **Acceptance Criteria:**
  - [ ] `packages/authentication` adds `DevHmacVerifier` behind a
        feature flag read from `Env`.
  - [ ] `POST /v1/auth/verify` returns
        `AuthenticatedPrincipal` on success.
  - [ ] ADR-010-dev-credential-verifier.md in `docs/decisions/`
        states threat model, when to retire, and how production
        verifiers will replace it.
  - [ ] `docs/security/authentication.md` is updated to call out
        the dev verifier and the Phase 4 production verifier.
  - [ ] Tests cover: expired credential, wrong audience, wrong
        issuer, valid dev credential, prod-environment rejection.
- **Technical Notes:** Use `crypto.subtle` only — no Node-only
  crypto APIs in the Worker bundle. Tokens carry `iss`, `aud`,
  `sub`, `iat`, `exp`. Subject is the external `provider_subject`.
- **Dependencies:** M1.3 [#9](https://github.com/pullPluto/Keys/issues/9); M0.3 [#5](https://github.com/pullPluto/Keys/issues/5) (ADR-009 must exist first so this ADR
  can reference it).

## Phase 2 — Authorization MVP (M2)

> Goal: a draft policy can be uploaded, activated, and consulted by
> `POST /v1/authorize`. The decision returns a `policy_version` and
> reasons, and never authorizes from KV.

### [Domain] `AuthorizationRequest` / `AuthorizationDecision` wiring through packages

- **Labels:** domain, backend, mvp
- **Milestone:** M2 — Authz MVP
- **Story Points:** 3
- **Description:** The contracts exist in `packages/authorization` but
  are unused. Make them the public surface and add `PolicyDocument`
  plus `PolicyStore` (read-only) and `PolicyActivator` (writes).
- **Acceptance Criteria:**
  - [ ] `PolicyDocument`, `PolicyStore`, `PolicyActivator` exported
        from `packages/authorization/src/index.ts`.
  - [ ] `PolicyStore.findActive(organizationId)` returns
        `PolicyDocument | null` and never reads from KV.
  - [ ] `tests/authorization-contracts.test.ts` covers the basic
        decision shape.
- **Technical Notes:** Decisions are about an `action` and a
  `resource` (both strings). Keep the language server-side only —
  no DSL exposed over HTTP yet.
- **Dependencies:** Phase 1 complete.

### [Database] D1 policy store + activator

- **Labels:** database, backend, mvp
- **Milestone:** M2 — Authz MVP
- **Story Points:** 5
- **Description:** Implement `PolicyStore` and `PolicyActivator`
  against D1. Activation is a transactional bump of the
  `status` from `draft` → `active` and writing
  `activated_at`; previous `active` rows become `superseded`.
- **Acceptance Criteria:**
  - [ ] `tests/policy-d1.test.ts` round-trips a policy from draft
        through activation and verifies only one `active` per org.
  - [ ] An audit row is written on activation (deferred audit
        contract; can be a console.log in dev with a TODO marker
        replaced by 3.2).
- **Technical Notes:** D1 is single-writer per database; a simple
  `UPDATE ... WHERE status='active'` followed by `INSERT` is fine
  for the MVP volume. Document the volume assumption in the ADR.
- **Dependencies:** M2.1 [#11](https://github.com/pullPluto/Keys/issues/11).

### [Backend] `POST /v1/policies` and `POST /v1/policies/:id/activate` routes

- **Labels:** backend, security, mvp
- **Milestone:** M2 — Authz MVP
- **Story Points:** 5
- **Description:** Two routes to upload a draft policy and activate
  it. Activation is irreversible without a new version.
- **Acceptance Criteria:**
  - [ ] Drafts validated against a minimal JSON schema
        (action, resource, effect, when-clause). Schema lives in
        `packages/authorization/src/policy-schema.ts`.
  - [ ] Activation requires a verified principal with the
        `policy.admin` capability. The capability is sourced from
        the policy itself for bootstrap, then from the role
        assignments in Phase 4.
  - [ ] Re-activating an already-active version is a no-op + 200.
  - [ ] `docs/security/enterprise-baseline.md` is updated to flag
        the bootstrap caveat ("single identity can grant a
        privileged action without two-person control until
        Phase 4").
  - [ ] Tests cover: invalid JSON, missing fields, activation by
        non-admin (403), double activation idempotency.
- **Technical Notes:** Bootstrap chicken-and-egg: the first
  `policy.admin` must come from a hard-coded dev list read from
  `Env.MVP_BOOTSTRAP_ADMINS` (a JSON array). Document that this
  variable is removed in Phase 4.
- **Dependencies:** M2.1 [#11](https://github.com/pullPluto/Keys/issues/11), M2.2 [#12](https://github.com/pullPluto/Keys/issues/12); M1.4 [#10](https://github.com/pullPluto/Keys/issues/10) (verifier must exist for principal
  check).

### [Backend] `POST /v1/authorize` and the default-deny rule

- **Labels:** backend, security, mvp
- **Milestone:** M2 — Authz MVP
- **Story Points:** 5
- **Description:** Consult the active policy, return
  `AuthorizationDecision`. If no policy is active, the result is
  deny with `reason_code: "no_active_policy"`. Bounded KV cache is
  allowed for decision memoization but **only** with the bounded
  revocation design required by AGENTS.md §Safety rules.
- **Acceptance Criteria:**
  - [ ] `POST /v1/authorize` returns 200 with a decision body that
        includes `effect`, `policy_version`, and `reason_code`.
  - [ ] KV usage, if any, is opt-in via `Env.AUTHORIZATION_CACHE=`
        and a TTL ≤ 5s.
  - [ ] When a policy is activated, the next call must observe the
        new version within 5s.
  - [ ] `docs/security/authorization.md` is updated to record the
        bounded-revocation design (5 s window + in-D1 policy
        version bump on every activation).
  - [ ] `docs/architecture/authorization.md` is updated to note
        the bootstrap removal in Phase 4.
  - [ ] Tests: default deny without a policy, allow after
        activation, deny after activation of a different version.
- **Technical Notes:** Add a TODO note that production must use a
  documented bounded-revocation design before KV can serve
  decisions.
- **Dependencies:** M2.3 [#13](https://github.com/pullPluto/Keys/issues/13).

## Phase 3 — Audit & Hardening (M3)

> Goal: every MVP route writes a normalized audit event, the health
>  endpoint still leaks nothing, and a single test invocation
>  exercises the full tenant → identity → policy → authorize loop.

### [Domain] `AuditSink` contract and D1 implementation

- **Labels:** domain, database, security, mvp
- **Milestone:** M3 — Audit & Hardening
- **Story Points:** 5
- **Description:** The `audit_events` table from `0001` is unused.
  Implement `AuditSink.append` against D1 with a strict allowlist
  of `metadata` keys. Anything not on the allowlist is dropped
  before write.
- **Acceptance Criteria:**
  - [ ] `packages/audit/src/index.ts` exports a `metadataAllowlist`
        constant; any key not on the list is dropped with a
        warning logged at `info` level (no payload content in log).
  - [ ] `tests/audit-d1.test.ts` round-trips an event and asserts
        disallowed keys are not present in the row.
  - [ ] ADR-011-audit-redaction.md records the allowlist and the
        rationale (what is allowed, why, retention).
  - [ ] `docs/security/auditing.md` is updated to reference the
        ADR and the MVP envelope.
- **Technical Notes:** The AGENTS.md rule "Do not log bearer
  tokens, prompts, model responses, or raw sensitive attributes by
  default" is the source of truth. The allowlist encodes what
  counts as non-sensitive.
- **Dependencies:** Phase 2 complete.

### [Backend] Wire audit emit into all MVP routes

- **Labels:** backend, security, mvp
- **Milestone:** M3 — Audit & Hardening
- **Story Points:** 3
- **Description:** Replace the TODO markers from Phase 1 and 2
  with real `AuditSink.append` calls. Failures to write an audit
  event must fail the originating request closed (or 500), not
  silently succeed.
- **Acceptance Criteria:**
  - [ ] Each of `tenants`, `identities`, `policies`, `policies/:id/activate`,
        `authorize` emits exactly one `audit_event` per request.
  - [ ] Deny and error outcomes are distinguishable in
        `outcome`.
  - [ ] Tests assert one row per call and that audit failure
        produces a 500.
  - [ ] `docs/operations/monitoring.md` is updated to record the
        "audit failure → 500" behavior as an MVP hard rule, with
        a note that production may revisit it.
- **Technical Notes:** Audit must be best-effort only when
  explicitly flagged (Phase 4 retention design will revisit this
  if needed). For MVP, fail-closed is correct.
- **Dependencies:** M3.1 [#15](https://github.com/pullPluto/Keys/issues/15).

### [Testing] Test harness builder for authenticated request sequences

- **Labels:** testing, mvp
- **Milestone:** M3 — Audit & Hardening
- **Story Points:** 2
- **Description:** A small helper that builds a sequence of
  `Request` objects pre-signed with the dev HMAC verifier and
  threads a single `correlationId` through them. Lives in
  `tests/_support/sequences.ts` and is the only place tests
  construct authenticated requests.
- **Acceptance Criteria:**
  - [ ] `createAuthedRequest({ method, path, body, identity })`
        returns a `Request` with a valid dev credential header.
  - [ ] `runSequence(env, [req1, req2, ...])` returns an array of
        responses and a single `correlationId` shared across them.
  - [ ] The helper refuses to issue a request when
        `env.ENVIRONMENT === "production"`.
- **Technical Notes:** Depends on M1.4 [#10](https://github.com/pullPluto/Keys/issues/10); uses `DevHmacVerifier` to
  sign each request, so the helper can be used to exercise 1.3,
  2.3, 2.4, 3.2, and 3.3b–3.3d without re-implementing the
  signing path.
- **Dependencies:** M0.4 [#6](https://github.com/pullPluto/Keys/issues/6) (env harness), M1.4 [#10](https://github.com/pullPluto/Keys/issues/10) (dev verifier).

### [Testing] Per-route happy-path coverage (tenants, identities, policies, authorize)

- **Labels:** testing, mvp
- **Milestone:** M3 — Audit & Hardening
- **Story Points:** 2
- **Description:** One test per route, in its own file, that drives
  the route through `runSequence` and asserts the response shape.
  No cross-route assertions here — those live in 3.3c.
- **Acceptance Criteria:**
  - [ ] `tests/routes/tenants.test.ts`,
        `tests/routes/identities.test.ts`,
        `tests/routes/policies.test.ts`,
        `tests/routes/authorize.test.ts` exist.
  - [ ] Each test exercises exactly one route's happy path and one
        documented failure case (400/403/409).
  - [ ] Tests run in under 500 ms each on a developer laptop.
- **Dependencies:** M3.3 [#17](https://github.com/pullPluto/Keys/issues/17) (the harness).

### [Testing] Cross-route authorization decision assertions

- **Labels:** testing, mvp
- **Milestone:** M3 — Audit & Hardening
- **Story Points:** 2
- **Description:** Drives the full sequence: create tenant → create
  identity → verify → upload draft policy → activate → authorize
  (allow) → authorize unknown action (deny). Asserts the decision
  body's `policy_version` matches the activated version and that
  the unknown action returns `deny` with a stable `reason_code`.
- **Acceptance Criteria:**
  - [ ] `tests/routes/authorize-cross-route.test.ts` exists.
  - [ ] The test runs in under 1 s on a developer laptop.
  - [ ] The test does not assert on audit row counts; that lives
        in 3.3d.
- **Dependencies:** M3.3 [#17](https://github.com/pullPluto/Keys/issues/17), M3.4 [#18](https://github.com/pullPluto/Keys/issues/18).

### [Testing] Audit log shape and count assertions

- **Labels:** testing, mvp
- **Milestone:** M3 — Audit & Hardening
- **Story Points:** 1
- **Description:** The single end-to-end test that asserts the
  audit log has exactly the expected number of rows and that the
  `policy_version` on the allow decision matches the activated
  version. Runs the same sequence as 3.3b but inspects the
  `audit_events` table.
- **Acceptance Criteria:**
  - [ ] `tests/audit-end-to-end.test.ts` exists.
  - [ ] Asserts one `audit_event` per request and that audit
        failure produces a 500.
- **Dependencies:** M3.1 [#15](https://github.com/pullPluto/Keys/issues/15), M3.2 [#16](https://github.com/pullPluto/Keys/issues/16), M3.4 [#18](https://github.com/pullPluto/Keys/issues/18), M3.5 [#19](https://github.com/pullPluto/Keys/issues/19).

### [Security] Health endpoint leakage review

- **Labels:** security, testing, mvp
- **Milestone:** M3 — Audit & Hardening
- **Story Points:** 2
- **Description:** AGENTS.md requires that a health endpoint reveal
  no tenant, account, version, or dependency detail. Today the
  Worker and SysKey both return `{ status: "ok", service: "..." }`.
  Add an explicit test that rejects any new key on the health
  response.
- **Acceptance Criteria:**
  - [ ] `tests/health-leakage.test.ts` asserts the response body
        has exactly the two allowed keys for both Workers.
  - [ ] `docs/architecture/data-flow.md` is updated to reference
        the test as the pinning contract for the health response.
  - [ ] `docs/security/auditing.md` (or a sibling) records the
        rule and references the test.
- **Dependencies:** none.

## Phase 4 — Production Gates (M4)

> Goal: clear the unresolved gates from `AGENTS.md` and `README.md`
>  before any production deployment. These are *mostly* decision
>  work; only one of them is a code change.

These issues are intentionally underspecified. Each one becomes its
own ADR + implementation increment when the owner decides to clear
the gate. Closing a gate requires the corresponding ADR to be merged
in the **same** PR as the code/config change; a code change without
the ADR does not close the gate.

### [Decision, adr-required] Name a backup break-glass administrator

- **Labels:** docs, adr-required, security
- **Milestone:** M4 — Production Gates
- **Story Points:** 2
- **Description:** Today the backup break-glass administrator is
  `TBD`. This issue tracks the decision: name a person, record the
  handoff procedure, and link it from `docs/operations/ownership.md`
  and `docs/architecture/syskey-fallback.md`.
- **Acceptance Criteria:**
  - [ ] `docs/operations/ownership.md` updated with the named
        backup and a handoff procedure.
  - [ ] ADR-012-backup-breakglass.md records the decision and
        review cadence.
- **Dependencies:** owner decision (not blockable by code).

### [Decision, adr-required] Approve retention periods and data classification

- **Labels:** docs, adr-required, security
- **Milestone:** M4 — Production Gates
- **Story Points:** 3
- **Description:** Audit retention, R2 object lifecycle, and the
  redaction allowlist all depend on approved retention periods.
  This issue captures the approval and the cross-references.
- **Acceptance Criteria:**
  - [ ] `docs/security/auditing.md` updated with the approved
        retention numbers and a review schedule.
  - [ ] ADR-013-retention-and-classification.md records what
        data class lives in D1, KV, and R2.
  - [ ] `docs/operations/backups.md` is updated to point at the
        ADR.
- **Dependencies:** M3.1 [#15](https://github.com/pullPluto/Keys/issues/15) (the allowlist must be defined before the
  retention numbers can be approved).

### [Docs] Assets inventory for the threat model

- **Labels:** docs, security
- **Milestone:** M4 — Production Gates
- **Story Points:** 2
- **Description:** Concrete list of components (Worker, D1, KV, R2,
  each domain package) and data classes (tenant, identity,
  credential, policy, audit event, role assignment) with a named
  owner for each row.
- **Acceptance Criteria:**
  - [ ] `docs/security/threat-model.md` (new) has a
        "Components and data" section.
  - [ ] Every row has an owner; rows with `TBD` owners are
        tracked as separate Phase 4 issues.
  - [ ] `docs/security/threat-detection.md` cross-links the new
        file.
- **Dependencies:** M4.1 [#22](https://github.com/pullPluto/Keys/issues/22) (the backup break-glass admin should be
  an asset owner before the inventory is complete).

### [Docs] Adversary and attack surface list

- **Labels:** docs, security
- **Milestone:** M4 — Production Gates
- **Story Points:** 2
- **Description:** Threat-ID-indexed list of adversary classes
  (external attacker, malicious insider, compromised operator,
  Cloudflare compromise) and the attack surfaces they can reach
  (Worker route, D1 row, KV cache, R2 object, OAuth issuer,
  email). The list is **not** a mitigation matrix — that lives
  in 4.3c.
- **Acceptance Criteria:**
  - [ ] `docs/security/threat-model.md` has an "Adversaries and
        attack surfaces" section.
  - [ ] Every threat has a stable `T-####` ID.
  - [ ] `docs/security/threat-detection.md` cross-links the new
        file.
- **Dependencies:** M4.3 [#24](https://github.com/pullPluto/Keys/issues/24).

### [Docs] Mitigation mapping for each threat

- **Labels:** docs, security
- **Milestone:** M4 — Production Gates
- **Story Points:** 2
- **Description:** For each `T-####` in 4.3b, link the existing
  control that mitigates it (or record the gap). The result is
  the basis for any "controls deployed" claim.
- **Acceptance Criteria:**
  - [ ] `docs/security/threat-model.md` has a "Mitigations"
        section with one row per `T-####`.
  - [ ] Gaps are recorded as new Phase 4+ issues, not silently
        accepted.
- **Dependencies:** M4.3 [#24](https://github.com/pullPluto/Keys/issues/24), M4.4 [#25](https://github.com/pullPluto/Keys/issues/25).

### [Docs] Incident response runbook

- **Labels:** docs, security
- **Milestone:** M4 — Production Gates
- **Story Points:** 3
- **Description:** Severity levels, on-call rotation, comms
  channels, escalation paths, and a tabletop recovery exercise
  date. Lives in `docs/operations/incident-response.md` (new).
- **Acceptance Criteria:**
  - [ ] `docs/operations/incident-response.md` exists and is
        cross-linked from `docs/operations/monitoring.md` and
        `docs/operations/backups.md`.
  - [ ] `docs/security/threat-detection.md` references the
        runbook as the action path for any threat that fires.
  - [ ] A dated recovery exercise is recorded in
        `docs/operations/backups.md`.
- **Dependencies:** M4.3 [#24](https://github.com/pullPluto/Keys/issues/24).

### [Backend] Reject `dev`/`staging` verifiers when `ENVIRONMENT=production`

- **Labels:** backend, security
- **Milestone:** M4 — Production Gates
- **Story Points:** 3
- **Description:** Phase 1 left a hard-coded rejection in the
  envelope. Replace it with a real production credential verifier
  (e.g. JWKS-based) and document the migration.
- **Acceptance Criteria:**
  - [ ] `packages/authentication` exports a `JwksVerifier` and the
        Worker binds it when `ENVIRONMENT === "production"`.
  - [ ] `DevHmacVerifier` is removed from the production code path
        and the import becomes a tree-shake-safe stub.
  - [ ] ADR-014-production-credential-verifier.md records the
        chosen issuer and the rotation procedure.
  - [ ] `docs/security/authentication.md` updated to mark the dev
        verifier as retired.
- **Dependencies:** M1.4 [#10](https://github.com/pullPluto/Keys/issues/10) (the dev verifier must exist before being
  replaced).

### [Docs] Update README "Status and delivery gates" section

- **Labels:** docs
- **Milestone:** M4 — Production Gates
- **Story Points:** 1
- **Description:** Once the previous issues are landed, the
  README's gate list should be empty. Update the section to
  reflect the cleared state and link each ADR.

### [Decision, adr-required] Per-app identity mapping for cross-tool user references

- **Labels:** backend, security, adr-required, docs
- **Milestone:** M4 — Production Gates
- **Story Points:** 5
- **Description:** Today there is no shared user identifier across
  PullPluto tools. A `users` row in D1 has an internal id, an
  organization id, a `primary_email`, and a `display_name` — but
  no stable, app-independent handle that one tool can hand to
  another tool so the second tool can resolve "the same person."
  This is the prerequisite for live staff-directory search and
  for any cross-tool "mention" or notification flow.

  This issue is the *decision* half of the work. The implementation
  lives in a follow-up issue (or several) that opens only after
  the ADR is merged. The decision must answer five questions:

  1. **Universal user UUID.** Keys generates a stable
     `user_uuid` per `users` row, written once and never rotated
     except under an explicit re-keying ADR. The UUID is
     *internal* — it never appears in any application-facing
     response.
  2. **Per-app opaque handle.** When an application calls Keys
     to resolve or search users, Keys returns a **per-app
     opaque identifier** (`app_user_id`) that maps to the
     internal `user_uuid` inside Keys. The mapping is keyed by
     the calling application's registry id. Two different
     applications receive different `app_user_id` values for
     the same person, and neither can derive the other's
     `app_user_id` from its own.
  3. **Field shaping per application.** Each application
     declares the set of user fields it is approved to receive
     in its application registration (`allowed_user_fields`).
     Keys returns only the intersection of (the requested
     fields) and (the application's allow-list). A field that
     is in the database but not in the allow-list is never
     returned, even if requested.
  4. **`chosen_name` as the default display field.** For
     the MVP's first slice, the only human-readable field any
     application can request is the user's *chosen name*. The
     `primary_email` and `display_name` columns exist for
     internal use but are not part of the application-facing
     response by default. Adding `primary_email` or other
     fields to an application's allow-list is a separate
     privileged change that requires a second SysAdmin
     approval.
  5. **Search endpoint contract.** `GET /v1/users` (or the
     equivalent) accepts a query string, a field selector, and
     a limit, and returns an array of `{ app_user_id,
     chosen_name }` rows. The response is paginated and
     bounded. The endpoint requires a registered application
     with the `users.read` capability; the `chosen_name`
     field and the `app_user_id` field are returned only when
     the application has them in its allow-list.

  Out of scope for this decision (and for any implementation
  that follows it):

  - The actual `users` table CRUD endpoints (those are
    part of the universal application registry and the HR
    provisioning queue, both already noted as later phases).
  - Cross-organization user resolution.
  - Username, handle, or alias uniqueness guarantees across
    applications.
  - Real-time presence or activity signals.

- **Acceptance Criteria:**
  - [ ] `docs/decisions/ADR-015-per-app-identity-mapping.md`
        exists and answers the five questions above.
  - [ ] The ADR names the data class (`app_user_id` mapping
        rows) and records the privacy basis, retention, and
        rotation rules.
  - [ ] The ADR is cross-linked from
        `docs/architecture/identity-model.md`,
        `docs/architecture/application-registry.md`, and
        `docs/security/auditing.md`.
  - [ ] An implementation-tracking issue (or issues) is filed
        in the same milestone and references the ADR; the
        implementation issue is `adr-required` and points back
        at the ADR.
  - [ ] `docs/decisions/backlog/mvp.md` "Issue index" updated
        to add the implementation issue and the new doc edits.
- **Technical Notes:**
  - The per-app mapping is the simplest possible: a
    `(application_id, user_uuid, app_user_id)` row. The
    `app_user_id` is generated by Keys at first resolution
    and never re-issued unless the application is
    re-provisioned under a new ADR.
  - Search results are not cached in KV without a documented
    bounded-revocation design (AGENTS.md safety rule).
  - The search endpoint is a Worker route; the mapping table
    is in D1; no KV writes.
  - The endpoint is `501` in production until M4.7 (issue #28)
    replaces the dev credential verifier with the production
    JWKS verifier.
  - Do not invent field names. The ADR must name the field
    the application receives (currently: `chosen_name`).
- **Dependencies:**
    [M4.7 #28](https://github.com/pullPluto/Keys/issues/28) (the
    production credential verifier must exist before any
    non-501 endpoint ships), and
    [M4.2 #23](https://github.com/pullPluto/Keys/issues/23) (the
    retention period for the mapping rows is part of M4.2's
    scope).

## Cross-phase quality bar

- Every PR that lands an MVP issue must keep
  `npm run typecheck` and `npm test` green on a clean clone.
- Every issue with `adr-required` lands its ADR in the **same**
  PR as the code change, or in a follow-up PR that is referenced
  from the code PR description.
- No new dependency may be added without an ADR (Frameworks
  sufficiency ladder).
- No code path may read from KV to make an authorization decision
  without the bounded-revocation design in an ADR.
- No issue is larger than 5 story points. If a follow-up issue
  feels like an 8, split it the same way 3.3 and 4.3 were split.

## Suggested sequencing

1. M0: M0.3, M0.1, M0.2, M0.4 (ADR, migration runner, envelope,
   test harness).
2. M1: M1.1, M1.2, M1.3, M1.4 (identity contract, D1 repos,
   routes, ADR-010, verifier).
3. M2: M2.1, M2.2, M2.3, M2.4 (authz contract, D1 policy, routes,
   authorize route).
4. M3: M3.1, M3.2, M3.3, M3.4, M3.5, M3.6, M3.7 (audit sink,
   wire audit, harness, route tests, cross-route test, audit
   test, leakage review).
5. M4: M4.1, M4.2, M4.3, M4.4, M4.5, M4.6, M4.7, M4.8, M4.9 (backup
   break-glass admin, retention, threat model, prod verifier,
   README update, per-app identity mapping decision).

Each phase is a release boundary. Don't promote a phase to "done"
without its exit criteria passing in CI.

## Issue index (with GitHub issue numbers)

Each `[Mx.y]` issue below is also filed as a GitHub issue on
`pullPluto/Keys`. Use the number to link from PRs and discussions.

| ID | GitHub | Title |
| --- | --- | --- |
| M0.1 | [#3](https://github.com/pullPluto/Keys/issues/3) | Wire D1 migration runner and seed bootstrap |
| M0.2 | [#4](https://github.com/pullPluto/Keys/issues/4) | Add request envelope and shared error response shape |
| M0.3 | [#5](https://github.com/pullPluto/Keys/issues/5) | Record the MVP definition in a decision record |
| M0.4 | [#6](https://github.com/pullPluto/Keys/issues/6) | Add Worker route harness and CI-equivalent check script |
| M1.1 | [#7](https://github.com/pullPluto/Keys/issues/7) | Add tenant use-cases in `packages/identity` |
| M1.2 | [#8](https://github.com/pullPluto/Keys/issues/8) | D1 repository implementation for identity package |
| M1.3 | [#9](https://github.com/pullPluto/Keys/issues/9) | `POST /v1/tenants` and `POST /v1/identities` Worker routes |
| M1.4 | [#10](https://github.com/pullPluto/Keys/issues/10) | Dev-only credential verifier contract |
| M2.1 | [#11](https://github.com/pullPluto/Keys/issues/11) | `AuthorizationRequest` / `AuthorizationDecision` wiring through packages |
| M2.2 | [#12](https://github.com/pullPluto/Keys/issues/12) | D1 policy store + activator |
| M2.3 | [#13](https://github.com/pullPluto/Keys/issues/13) | `POST /v1/policies` and `POST /v1/policies/:id/activate` routes |
| M2.4 | [#14](https://github.com/pullPluto/Keys/issues/14) | `POST /v1/authorize` and the default-deny rule |
| M3.1 | [#15](https://github.com/pullPluto/Keys/issues/15) | `AuditSink` contract and D1 implementation |
| M3.2 | [#16](https://github.com/pullPluto/Keys/issues/16) | Wire audit emit into all MVP routes |
| M3.3 | [#17](https://github.com/pullPluto/Keys/issues/17) | Test harness builder for authenticated request sequences |
| M3.4 | [#18](https://github.com/pullPluto/Keys/issues/18) | Per-route happy-path coverage (tenants, identities, policies, authorize) |
| M3.5 | [#19](https://github.com/pullPluto/Keys/issues/19) | Cross-route authorization decision assertions |
| M3.6 | [#20](https://github.com/pullPluto/Keys/issues/20) | Audit log shape and count assertions |
| M3.7 | [#21](https://github.com/pullPluto/Keys/issues/21) | Health endpoint leakage review |
| M4.1 | [#22](https://github.com/pullPluto/Keys/issues/22) | Name a backup break-glass administrator |
| M4.2 | [#23](https://github.com/pullPluto/Keys/issues/23) | Approve retention periods and data classification |
| M4.3 | [#24](https://github.com/pullPluto/Keys/issues/24) | Assets inventory for the threat model |
| M4.4 | [#25](https://github.com/pullPluto/Keys/issues/25) | Adversary and attack surface list |
| M4.5 | [#26](https://github.com/pullPluto/Keys/issues/26) | Mitigation mapping for each threat |
| M4.6 | [#27](https://github.com/pullPluto/Keys/issues/27) | Incident response runbook |
| M4.7 | [#28](https://github.com/pullPluto/Keys/issues/28) | Reject `dev`/`staging` verifiers when `ENVIRONMENT=production` |
| M4.8 | [#29](https://github.com/pullPluto/Keys/issues/29) | Update README "Status and delivery gates" section |
| M4.9 | [#31](https://github.com/pullPluto/Keys/issues/31) | Per-app identity mapping for cross-tool user references |

Total: 28 issues. Largest is 5 story points; median is 3.
