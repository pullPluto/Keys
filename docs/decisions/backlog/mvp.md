# Keys MVP — Phase-by-Phase Issue Backlog

**Owner:** commissioning user (initial accountable owner)
**Status:** proposed; not yet committed
**Companion to:** `docs/architecture/overview.md`, `AGENTS.md`, `docs/security/`, `docs/operations/`

This document is the first increment of work after the foundation commit
(`acda5f1`) and the Mission Control boundary commit (`c91c9f9`). It is the
*proposed* MVP for Keys: the smallest set of changes that turns the current
scaffold into a real, exercised control plane for **internal** identity and
authorization, while keeping every AGENTS.md boundary intact.

The backlog is intentionally narrow. It does **not** include OIDC issuance,
WebAuthn, TOTP, the AI/agent/MCP gateways, the universal application registry,
HR-driven provisioning, or SysKey break-glass behavior. Those are later
phases (Phase 4+) and each gets its own ADR-driven increment.

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

- OIDC / OAuth client_credentials issuance
- WebAuthn, TOTP, password storage, magic links
- Universal application registry and protocol selection (OIDC/SAML/SCIM/LDAP-bridge)
- HR-mediated provisioning queue
- AI gateway, agent gateway, MCP policy
- Production tenancy, backup/restore, SLOs, retention period approval
- SysKey break-glass activation flows
- Any deployment beyond `wrangler dev` against a personal sandbox account

## Conventions for the issues in this backlog

- Labels: `mvp`, `backend`, `domain`, `database`, `security`, `docs`,
  `testing`, `infrastructure`, `adr-required`.
- Milestone: `M0 — MVP Foundations`, `M1 — Identity MVP`,
  `M2 — Authz MVP`, `M3 — Audit & Hardening`, `M4 — Production Gates`.
- Story points: 1, 2, 3, 5, or 8 (Fibonacci).
- Every issue names the file(s) it will create or modify.
- Every issue with `adr-required` must land an ADR in `docs/decisions/`
  in the same PR.

## Phase 0 — MVP Foundations (M0)

> Goal: stop the scaffold from being only a health endpoint. Add a
> real route surface, a shared test harness, and the migration runner
> shape. No new domain behavior yet.

Exit criteria: `npm run typecheck` and `npm test` pass; a second route
exists in the Worker; the migration runner is wired through Wrangler.

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
- **Technical Notes:**
  - Use the platform `Request`/`Response` only; do **not** introduce
    a router framework yet (sufficiency ladder).
  - Keep envelope dependency-free; validation can be a tiny hand-rolled
    schema until Phase 4 when something heavier is justified by an ADR.
- **Dependencies:** Phase 0 issue 1 (migration runner) — non-blocking
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
- **Dependencies:** Phase 0 issue 2 (envelope).

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
- **Technical Notes:** Stay platform-agnostic. No Cloudflare types in
  the package.
- **Dependencies:** Phase 0 issue 3 (ADR-009).

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
- **Dependencies:** Phase 1 issue 1; Phase 0 issue 4 (env test harness).

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
        (MVP is dev/staging only; enforce it in the envelope).
  - [ ] Every successful and failed call emits an `audit_event` row
        (see Phase 3 audit issue) — write a TODO marker so the
        audit emit lands in Phase 3.
  - [ ] Tests in `tests/identity-routes.test.ts` cover happy path,
        duplicate slug (409), bad JSON (400), and prod environment
        rejection.
- **Technical Notes:** Validate the slug against a strict regex
  (`^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$`) and reject reserved slugs
  (`admin`, `system`, `syskey`, `keys`).
- **Dependencies:** Phase 1 issues 1 + 2.

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
  - [ ] Tests cover: expired credential, wrong audience, wrong
        issuer, valid dev credential, prod-environment rejection.
- **Technical Notes:** Use `crypto.subtle` only — no Node-only
  crypto APIs in the Worker bundle. Tokens carry `iss`, `aud`,
  `sub`, `iat`, `exp`. Subject is the external `provider_subject`.
- **Dependencies:** Phase 1 issue 3; Phase 0 issue 3 (ADR-009 must
  exist first so this ADR can reference it).

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
        contract; can be a console.log in dev with a TODO marker).
- **Technical Notes:** D1 is single-writer per database; a simple
  `UPDATE ... WHERE status='active'` followed by `INSERT` is fine
  for the MVP volume. Document the volume assumption in the ADR.
- **Dependencies:** Phase 2 issue 1.

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
  - [ ] Tests cover: invalid JSON, missing fields, activation by
        non-admin (403), double activation idempotency.
- **Technical Notes:** Bootstrap chicken-and-egg: the first
  `policy.admin` must come from a hard-coded dev list read from
  `Env.MVP_BOOTSTRAP_ADMINS` (a JSON array). Document that this
  variable is removed in Phase 4.
- **Dependencies:** Phase 2 issues 1 + 2; Phase 1 issue 4
  (verifier must exist for principal check).

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
  - [ ] Tests: default deny without a policy, allow after
        activation, deny after activation of a different version.
- **Technical Notes:** Add a TODO note that production must use a
  documented bounded-revocation design before KV can serve
  decisions.
- **Dependencies:** Phase 2 issue 3.

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
- **Technical Notes:** Audit must be best-effort only when
  explicitly flagged (Phase 4 retention design will revisit this
  if needed). For MVP, fail-closed is correct.
- **Dependencies:** Phase 3 issue 1.

### [Testing] End-to-end happy path test against the test harness

- **Labels:** testing, mvp
- **Milestone:** M3 — Audit & Hardening
- **Story Points:** 5
- **Description:** A single test that drives the full MVP loop:
  create tenant → create identity → verify credential → upload
  draft policy → activate → authorize (allow) → authorize unknown
  action (deny) → query audit log. Lives in
  `tests/mvp-end-to-end.test.ts`.
- **Acceptance Criteria:**
  - [ ] One test file, one `node:test` describe block.
  - [ ] Asserts the audit log has exactly the expected number
        of rows and that the `policy_version` on the allow
        decision matches the activated version.
  - [ ] Runs in under 2s on a developer laptop.
- **Technical Notes:** This is the gate the README "Local
  development" section can point at as proof the MVP is real.
- **Dependencies:** Phase 3 issues 1 + 2.

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
  - [ ] `docs/security/auditing.md` (or a sibling) records the
        rule and references the test.
- **Dependencies:** none.

## Phase 4 — Production Gates (M4)

> Goal: clear the unresolved gates from `AGENTS.md` and `README.md`
>  before any production deployment. These are *mostly* decision
>  work; only one of them is a code change.

These issues are intentionally underspecified. Each one becomes its
own ADR + implementation increment when the owner decides to clear
the gate.

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

### [Decision, adr-required] Threat model, incident response, and recovery exercise

- **Labels:** docs, adr-required, security
- **Milestone:** M4 — Production Gates
- **Story Points:** 5
- **Description:** Capture the threat model (ref
  `docs/security/threat-detection.md`), the incident response
  procedure (new doc), and schedule the first tabletop recovery
  exercise.
- **Acceptance Criteria:**
  - [ ] `docs/security/threat-model.md` (new) lists assets,
        adversaries, attack surfaces, and mitigations mapped to
        the existing controls.
  - [ ] `docs/operations/incident-response.md` (new) defines
        severity levels, on-call, and communication channels.
  - [ ] A dated recovery exercise is recorded in
        `docs/operations/backups.md`.

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

### [Docs] Update README "Status and delivery gates" section

- **Labels:** docs
- **Milestone:** M4 — Production Gates
- **Story Points:** 1
- **Description:** Once the previous four issues are landed, the
  README's gate list should be empty. Update the section to
  reflect the cleared state and link each ADR.

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

## Suggested sequencing

1. Phase 0 issues 3, 1, 2, 4 (ADR, migration runner, envelope,
   test harness).
2. Phase 1 issues 1, 2, 3, 4, 5 (identity contract, D1 repos,
   routes, ADR-010, verifier).
3. Phase 2 issues 1, 2, 3, 4 (authz contract, D1 policy, routes,
   authorize route).
4. Phase 3 issues 1, 2, 3, 4 (audit sink, wire audit, end-to-end
   test, leakage review).
5. Phase 4 issues only after the owner clears each gate.

Each phase is a release boundary. Don't promote a phase to "done"
without its exit criteria passing in CI.
