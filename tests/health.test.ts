import assert from "node:assert/strict";
import test from "node:test";

import { healthResponse } from "../apps/worker/src/routes/health";
import syskeyWorker from "../apps/syskey/src/index";

test("health endpoint returns a non-sensitive, non-cacheable service status", async () => {
  const response = healthResponse();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { status: "ok", service: "keys" });
});

test("SysKey starts deny-by-default and has no emergency access route", async () => {
  const health = syskeyWorker.fetch(new Request("https://syskey.example/healthz"));
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), {
    status: "ok",
    service: "syskey",
    mode: "deny-by-default",
  });

  const protectedRoute = syskeyWorker.fetch(new Request("https://syskey.example/fallback/access"));
  assert.equal(protectedRoute.status, 404);
});
