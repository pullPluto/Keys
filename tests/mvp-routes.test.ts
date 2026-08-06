// tests/mvp-routes.test.ts
//
// M3.3a-d: per-route, cross-route, audit assertions for the MVP.

import assert from "node:assert/strict";
import test from "node:test";

import { mvpEnv, runSequence } from "./_support/sequences";
import { selectAll } from "./_support/env";

test("M3.3a: POST /v1/tenants creates an organization", async () => {
  const env = mvpEnv();
  const seq = await runSequence(
    [{ method: "POST", path: "/v1/tenants", body: { slug: "acme" } }],
    { env, subject: "bootstrap-admin" },
  );
  const res = seq.responses[0];
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.slug, "acme");
  assert.equal(body.status, "active");
  assert.ok(body.id);
  const rows = await selectAll(env, "organizations");
  assert.equal(rows.length, 1);
});

test("M3.3a: POST /v1/tenants rejects a duplicate slug with 409", async () => {
  const env = mvpEnv();
  const seq = await runSequence(
    [
      { method: "POST", path: "/v1/tenants", body: { slug: "acme" } },
      { method: "POST", path: "/v1/tenants", body: { slug: "acme" } },
    ],
    { env, subject: "bootstrap-admin" },
  );
  assert.equal(seq.responses[0].status, 201);
  assert.equal(seq.responses[1].status, 409);
  const body = await seq.responses[1].json();
  assert.equal(body.error.code, "slug_taken");
});

test("M3.3a: POST /v1/tenants rejects an invalid slug with 400", async () => {
  const env = mvpEnv();
  const seq = await runSequence(
    [{ method: "POST", path: "/v1/tenants", body: { slug: "Admin" } }],
    { env, subject: "bootstrap-admin" },
  );
  assert.equal(seq.responses[0].status, 400);
  const body = await seq.responses[0].json();
  assert.equal(body.error.code, "invalid_slug");
});

test("M3.3a: POST /v1/auth/verify accepts a valid dev token and returns the principal", async () => {
  const env = mvpEnv();
  const seq = await runSequence(
    [{ method: "POST", path: "/v1/auth/verify" }],
    { env, subject: "alice" },
  );
  assert.equal(seq.responses[0].status, 200);
  const body = await seq.responses[0].json();
  assert.equal(body.subject, "alice");
  assert.equal(body.issuer, "keys-pluto-dev");
});

test("M3.3a: POST /v1/identities registers an identity under a tenant", async () => {
  const env = mvpEnv();
  const seq = await runSequence(
    [
      { method: "POST", path: "/v1/tenants", body: { slug: "acme" } },
      { method: "POST", path: "/v1/identities", body: { organization_id: "_TBD_", provider: "dev" } },
    ],
    { env, subject: "alice" },
  );
  // Patch the second request with the org id from the first.
  const tenant = await seq.responses[0].json();
  const seq2 = await runSequence(
    [
      { method: "POST", path: "/v1/identities", body: { organization_id: tenant.id, provider: "dev" } },
    ],
    { env, subject: "alice", correlationId: seq.correlationId },
  );
  const res = seq2.responses[0];
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.provider, "dev");
  assert.equal(body.provider_subject, "alice");
  const rows = await selectAll(env, "identities");
  assert.equal(rows.length, 1);
  void seq; // ensure seq is referenced; the first call is exploration
});

test("M3.3a: POST /v1/identities returns 200 (not 201) on a re-registration", async () => {
  const env = mvpEnv();
  const tenantSeq = await runSequence(
    [{ method: "POST", path: "/v1/tenants", body: { slug: "acme" } }],
    { env, subject: "alice" },
  );
  const tenant = await tenantSeq.responses[0].json();
  const seq = await runSequence(
    [
      { method: "POST", path: "/v1/identities", body: { organization_id: tenant.id, provider: "dev" } },
      { method: "POST", path: "/v1/identities", body: { organization_id: tenant.id, provider: "dev" } },
    ],
    { env, subject: "alice" },
  );
  assert.equal(seq.responses[0].status, 201);
  assert.equal(seq.responses[1].status, 200);
});

test("M3.3a: POST /v1/identities returns 404 for an unknown tenant", async () => {
  const env = mvpEnv();
  const seq = await runSequence(
    [{ method: "POST", path: "/v1/identities", body: { organization_id: "missing", provider: "dev" } }],
    { env, subject: "alice" },
  );
  assert.equal(seq.responses[0].status, 404);
});

test("M3.3a: POST /v1/policies requires a bootstrap-admin subject", async () => {
  const env = mvpEnv({ bootstrapAdmins: ["bootstrap-admin"] });
  const tenantSeq = await runSequence(
    [{ method: "POST", path: "/v1/tenants", body: { slug: "acme" } }],
    { env, subject: "bootstrap-admin" },
  );
  const tenant = await tenantSeq.responses[0].json();
  const seq = await runSequence(
    [
      {
        method: "POST",
        path: "/v1/policies",
        body: {
          organization_id: tenant.id,
          document: { rules: [{ action: "read", resource: "*", effect: "allow" }] },
        },
      },
    ],
    { env, subject: "alice" }, // alice is not a bootstrap admin
  );
  assert.equal(seq.responses[0].status, 403);
  const body = await seq.responses[0].json();
  assert.equal(body.error.code, "not_bootstrap_admin");
});

test("M3.3a: POST /v1/policies creates a draft", async () => {
  const env = mvpEnv();
  const tenantSeq = await runSequence(
    [{ method: "POST", path: "/v1/tenants", body: { slug: "acme" } }],
    { env, subject: "bootstrap-admin" },
  );
  const tenant = await tenantSeq.responses[0].json();
  const seq = await runSequence(
    [
      {
        method: "POST",
        path: "/v1/policies",
        body: {
          organization_id: tenant.id,
          document: { rules: [{ action: "read", resource: "*", effect: "allow" }] },
        },
      },
    ],
    { env, subject: "bootstrap-admin" },
  );
  assert.equal(seq.responses[0].status, 201);
  const body = await seq.responses[0].json();
  assert.equal(body.status, "draft");
  assert.equal(body.version, 1);
});

test("M3.3a: POST /v1/policies validates the document with 400", async () => {
  const env = mvpEnv();
  const tenantSeq = await runSequence(
    [{ method: "POST", path: "/v1/tenants", body: { slug: "acme" } }],
    { env, subject: "bootstrap-admin" },
  );
  const tenant = await tenantSeq.responses[0].json();
  const seq = await runSequence(
    [
      {
        method: "POST",
        path: "/v1/policies",
        body: {
          organization_id: tenant.id,
          document: { rules: [{ action: "read", resource: "*", effect: "wat" }] },
        },
      },
    ],
    { env, subject: "bootstrap-admin" },
  );
  assert.equal(seq.responses[0].status, 400);
  const body = await seq.responses[0].json();
  assert.match(body.error.code, /rule_/);
});

test("M3.3a: POST /v1/policies/:id/activate activates a draft", async () => {
  const env = mvpEnv();
  const tenantSeq = await runSequence(
    [{ method: "POST", path: "/v1/tenants", body: { slug: "acme" } }],
    { env, subject: "bootstrap-admin" },
  );
  const tenant = await tenantSeq.responses[0].json();
  const createSeq = await runSequence(
    [
      {
        method: "POST",
        path: "/v1/policies",
        body: {
          organization_id: tenant.id,
          document: { rules: [{ action: "read", resource: "*", effect: "allow" }] },
        },
      },
    ],
    { env, subject: "bootstrap-admin" },
  );
  const policy = await createSeq.responses[0].json();
  const seq = await runSequence(
    [{ method: "POST", path: `/v1/policies/${policy.id}/activate` }],
    { env, subject: "bootstrap-admin" },
  );
  assert.equal(seq.responses[0].status, 200);
  const body = await seq.responses[0].json();
  assert.equal(body.status, "active");
  assert.ok(body.activated_at);
});

test("M3.3a: POST /v1/policies/:id/activate is idempotent on already-active", async () => {
  const env = mvpEnv();
  const tenantSeq = await runSequence(
    [{ method: "POST", path: "/v1/tenants", body: { slug: "acme" } }],
    { env, subject: "bootstrap-admin" },
  );
  const tenant = await tenantSeq.responses[0].json();
  const createSeq = await runSequence(
    [
      {
        method: "POST",
        path: "/v1/policies",
        body: {
          organization_id: tenant.id,
          document: { rules: [{ action: "read", resource: "*", effect: "allow" }] },
        },
      },
    ],
    { env, subject: "bootstrap-admin" },
  );
  const policy = await createSeq.responses[0].json();
  const seq = await runSequence(
    [
      { method: "POST", path: `/v1/policies/${policy.id}/activate` },
      { method: "POST", path: `/v1/policies/${policy.id}/activate` },
    ],
    { env, subject: "bootstrap-admin" },
  );
  assert.equal(seq.responses[0].status, 200);
  assert.equal(seq.responses[1].status, 200);
});

test("M3.3b: POST /v1/authorize returns deny before any policy is active", async () => {
  const env = mvpEnv();
  const tenantSeq = await runSequence(
    [{ method: "POST", path: "/v1/tenants", body: { slug: "acme" } }],
    { env, subject: "bootstrap-admin" },
  );
  const tenant = await tenantSeq.responses[0].json();
  await runSequence(
    [{ method: "POST", path: "/v1/identities", body: { organization_id: tenant.id, provider: "dev" } }],
    { env, subject: "alice" },
  );
  const seq = await runSequence(
    [
      {
        method: "POST",
        path: "/v1/authorize",
        body: { organization_id: tenant.id, action: "read", resource: "thing/1" },
      },
    ],
    { env, subject: "alice" },
  );
  assert.equal(seq.responses[0].status, 200);
  const body = await seq.responses[0].json();
  assert.equal(body.effect, "deny");
  assert.equal(body.reason_code, "no_active_policy");
});

test("M3.3b: POST /v1/authorize returns allow after a policy is activated and matches", async () => {
  const env = mvpEnv();
  // Bootstrap: create tenant, identity, draft policy, activate.
  const tenantSeq = await runSequence(
    [{ method: "POST", path: "/v1/tenants", body: { slug: "acme" } }],
    { env, subject: "bootstrap-admin" },
  );
  const tenant = await tenantSeq.responses[0].json();
  await runSequence(
    [{ method: "POST", path: "/v1/identities", body: { organization_id: tenant.id, provider: "dev" } }],
    { env, subject: "alice" },
  );
  const policySeq = await runSequence(
    [
      {
        method: "POST",
        path: "/v1/policies",
        body: {
          organization_id: tenant.id,
          document: { rules: [{ action: "read", resource: "*", effect: "allow" }] },
        },
      },
    ],
    { env, subject: "bootstrap-admin" },
  );
  const policy = await policySeq.responses[0].json();
  await runSequence(
    [{ method: "POST", path: `/v1/policies/${policy.id}/activate` }],
    { env, subject: "bootstrap-admin" },
  );
  // Authorize.
  const seq = await runSequence(
    [
      {
        method: "POST",
        path: "/v1/authorize",
        body: { organization_id: tenant.id, action: "read", resource: "thing/1" },
      },
    ],
    { env, subject: "alice" },
  );
  assert.equal(seq.responses[0].status, 200);
  const body = await seq.responses[0].json();
  assert.equal(body.effect, "allow");
  assert.equal(body.policy_version, 1);
});

test("M3.3b: POST /v1/authorize returns deny with no_matching_rule when action/resource don't match", async () => {
  const env = mvpEnv();
  const tenantSeq = await runSequence(
    [{ method: "POST", path: "/v1/tenants", body: { slug: "acme" } }],
    { env, subject: "bootstrap-admin" },
  );
  const tenant = await tenantSeq.responses[0].json();
  await runSequence(
    [{ method: "POST", path: "/v1/identities", body: { organization_id: tenant.id, provider: "dev" } }],
    { env, subject: "alice" },
  );
  const policySeq = await runSequence(
    [
      {
        method: "POST",
        path: "/v1/policies",
        body: {
          organization_id: tenant.id,
          document: { rules: [{ action: "read", resource: "*", effect: "allow" }] },
        },
      },
    ],
    { env, subject: "bootstrap-admin" },
  );
  const policy = await policySeq.responses[0].json();
  await runSequence(
    [{ method: "POST", path: `/v1/policies/${policy.id}/activate` }],
    { env, subject: "bootstrap-admin" },
  );
  const seq = await runSequence(
    [
      {
        method: "POST",
        path: "/v1/authorize",
        body: { organization_id: tenant.id, action: "delete", resource: "thing/1" },
      },
    ],
    { env, subject: "alice" },
  );
  assert.equal(seq.responses[0].status, 200);
  const body = await seq.responses[0].json();
  assert.equal(body.effect, "deny");
  assert.equal(body.reason_code, "no_matching_rule");
});

test("M3.3c: end-to-end audit assertions on the MVP loop", async () => {
  const env = mvpEnv();
  // Bootstrap: tenant + identity + policy + activate.
  const tenantSeq = await runSequence(
    [{ method: "POST", path: "/v1/tenants", body: { slug: "acme" } }],
    { env, subject: "bootstrap-admin" },
  );
  const tenant = await tenantSeq.responses[0].json();
  await runSequence(
    [{ method: "POST", path: "/v1/identities", body: { organization_id: tenant.id, provider: "dev" } }],
    { env, subject: "alice" },
  );
  const policySeq = await runSequence(
    [
      {
        method: "POST",
        path: "/v1/policies",
        body: {
          organization_id: tenant.id,
          document: { rules: [{ action: "read", resource: "*", effect: "allow" }] },
        },
      },
    ],
    { env, subject: "bootstrap-admin" },
  );
  const policy = await policySeq.responses[0].json();
  // Activate must run as a bootstrap admin; the same subject cannot
  // be both admin and end-user in a single sequence. Run activate
  // and authorize in separate sequences.
  const activateSeq = await runSequence(
    [{ method: "POST", path: `/v1/policies/${policy.id}/activate` }],
    { env, subject: "bootstrap-admin" },
  );
  assert.equal(activateSeq.responses[0].status, 200);
  const authSeq = await runSequence(
    [
      {
        method: "POST",
        path: "/v1/authorize",
        body: { organization_id: tenant.id, action: "read", resource: "thing/1" },
      },
    ],
    { env, subject: "alice" },
  );
  assert.equal(authSeq.responses[0].status, 200);
  const events = await selectAll(env, "audit_events");
  // 1 tenants.create + 1 identities.register + 1 policies.create + 1 policies.activate + 1 authorize = 5
  assert.equal(events.length, 5);
  const types = events.map((e) => e.event_type);
  assert.ok(types.includes("tenants.create"));
  assert.ok(types.includes("identities.register"));
  assert.ok(types.includes("policies.create"));
  assert.ok(types.includes("policies.activate"));
  assert.ok(types.includes("authorize"));
});

test("M3.4: production gate returns 501 for any non-health route", async () => {
  const env = mvpEnv();
  env.ENVIRONMENT = "production";
  const seq = await runSequence(
    [{ method: "POST", path: "/v1/tenants", body: { slug: "acme" } }],
    { env, subject: "bootstrap-admin" },
  );
  assert.equal(seq.responses[0].status, 501);
  const body = await seq.responses[0].json();
  assert.equal(body.error.code, "not_implemented_in_production");
});
