# ADR-009: Keys MVP definition

**Status:** Accepted for the MVP increment
**Decision:** The first deliverable for Keys is the **MVP** defined in
[`docs/decisions/backlog/mvp.md`](../decisions/backlog/mvp.md).

## Context

The repository had a working health endpoint, a D1 schema for control-plane
records, and a set of TypeScript domain interfaces. None of that was wired
into a real, exercised control plane. The MVP is the smallest set of
changes that turns the scaffold into a real, exercised identity +
authorization + audit loop on D1, with dev/staging-only credentials and
no production deployment.

## Scope

In scope, end-to-end, on a dev/staging deployment:

- A tenant record (`POST /v1/tenants`).
- An external identity link (`POST /v1/identities`).
- A dev-only HMAC credential verifier (`POST /v1/auth/verify`).
- A draft policy upload (`POST /v1/policies`).
- A policy activation route (`POST /v1/policies/:id/activate`).
- A default-deny authorize route (`POST /v1/authorize`).
- A normalized audit emit on every protected call, with a metadata
  allowlist enforced before write.
- An end-to-end test that drives the full loop and asserts the audit log
  has the expected shape.
- A health-endpoint leakage test that pins the allowed response keys.

## Out of scope (deferred)

OIDC/OAuth issuance, WebAuthn/TOTP, the universal application registry,
HR-driven provisioning, the AI/agent/MCP gateways, SysKey break-glass
activation, transactional email, production tenancy, backup/restore,
production SLOs, retention period approval. Each of these has its own
Phase 4 issue in the backlog and its own ADR.

## Exit criteria

A reviewer can:

1. Apply the migrations to a fresh D1 (`keys-pluto`) database.
2. Boot the Worker locally with `npm run dev` and hit `GET /healthz`.
3. `POST /v1/tenants` to register a tenant.
4. `POST /v1/identities` to register one external identity link.
5. `POST /v1/auth/verify` with a signed dev credential and receive a
   verified principal.
6. `POST /v1/authorize` and receive a `deny` until a draft policy is
   activated, then an `allow` referencing a `policy_version`.
7. Query the audit table and see normalized events with no sensitive
   payload retention.
8. Read every line that touched the request and find it in `packages/*` —
   the Worker route handlers are adapter shells only.

## Production gate

Every MVP route is rejected with `501` when `ENVIRONMENT === "production"`.
The dev HMAC verifier is refused at the Worker boundary in production.
The `M4.7` (issue #28) production credential verifier is the work that
turns any of this on for production.

## Consequences

- A reviewer cannot mistake the MVP for a production-ready system. The
  `501` on every non-health route in production is a hard guard.
- The dev HMAC verifier's secret is hard-coded in the dev worker
  configuration. The secret is *not* a real credential; it exists only to
  exercise the verifier in dev/staging. It is refused in production
  by the production gate.
- The bootstrap `policy.admin` capability in M2.3 is sourced from
  `Env.MVP_BOOTSTRAP_ADMINS` (a JSON array of identity subjects). The
  bootstrap is removed in Phase 4 when the role-assignment data model
  becomes a real product surface.
- The bounded-revocation KV cache in M2.4 has a 5 s TTL and a hard
  cap. Production must use a documented bounded-revocation design
  before KV can serve decisions.
