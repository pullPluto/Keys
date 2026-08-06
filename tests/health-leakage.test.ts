// tests/health-leakage.test.ts
//
// M3.7: AGENTS.md requires that the health endpoint reveal no
// tenant, account, version, or dependency detail. The test pins
// the response body to exactly the allowed keys.

import assert from "node:assert/strict";
import test from "node:test";

import worker from "../apps/worker/src/index";
import { mvpEnv } from "./_support/sequences";

test("health: response body has exactly the allowed keys (keys + syskey)", async () => {
  const env = mvpEnv();
  const req = new Request("https://keys-pluto.example/healthz", { method: "GET" });
  const res = await worker.fetch(req, env);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const body = await res.json();
  assert.deepEqual(body, { status: "ok", service: "keys" });
  // The two Worker services each have their own healthz. The keys
  // Worker says { status, service: "keys" }; the SysKey Worker
  // is tested in tests/health.test.ts.
  assert.equal(Object.keys(body).length, 2);
  for (const key of Object.keys(body)) {
    assert.ok(["status", "service"].includes(key), `unexpected key in health: ${key}`);
  }
  // And no tenant / account / version / dependency detail.
  const bodyRecord = body as Record<string, unknown>;
  for (const forbidden of ["tenant", "account", "version", "dep", "dependencies", "env", "environment"]) {
    assert.equal(bodyRecord[forbidden], undefined, `health leaked ${forbidden}`);
  }
});

test("health: works in production too (no 501)", async () => {
  const env = mvpEnv();
  env.ENVIRONMENT = "production";
  const req = new Request("https://keys-pluto.example/healthz", { method: "GET" });
  const res = await worker.fetch(req, env);
  assert.equal(res.status, 200);
});
