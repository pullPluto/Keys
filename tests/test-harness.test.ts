import assert from "node:assert/strict";
import test from "node:test";

import { createTestEnv, selectAll } from "./_support/env";

test("harness: insert + select on organizations", async () => {
  const env = createTestEnv();
  await env.KEYS_DB.prepare(
    "INSERT INTO organizations (id, slug, status, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind("org-1", "acme", "active", "2026-01-01")
    .run();
  const rows = await selectAll(env, "organizations");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].slug, "acme");
});

test("harness: PK conflict without ON CONFLICT throws", async () => {
  const env = createTestEnv();
  await env.KEYS_DB.prepare(
    "INSERT INTO organizations (id, slug, status, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind("org-1", "acme", "active", "2026-01-01")
    .run();
  await assert.rejects(
    env.KEYS_DB
      .prepare(
        "INSERT INTO organizations (id, slug, status, created_at) VALUES (?, ?, ?, ?)",
      )
      .bind("org-1", "acme", "active", "2026-01-01")
      .run(),
  );
});

test("harness: ON CONFLICT DO NOTHING is a no-op on conflict", async () => {
  const env = createTestEnv();
  await env.KEYS_DB.prepare(
    "INSERT INTO organizations (id, slug, status, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (id) DO NOTHING",
  )
    .bind("org-1", "acme", "active", "2026-01-01")
    .run();
  await env.KEYS_DB.prepare(
    "INSERT INTO organizations (id, slug, status, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (id) DO NOTHING",
  )
    .bind("org-1", "acme", "active", "2026-01-01")
    .run();
  const rows = await selectAll(env, "organizations");
  assert.equal(rows.length, 1);
});

test("harness: UNIQUE constraint on (slug) is enforced", async () => {
  const env = createTestEnv();
  await env.KEYS_DB.prepare(
    "INSERT INTO organizations (id, slug, status, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind("org-1", "acme", "active", "2026-01-01")
    .run();
  // Different id, same slug -> should conflict on the UNIQUE (slug)
  await assert.rejects(
    env.KEYS_DB
      .prepare(
        "INSERT INTO organizations (id, slug, status, created_at) VALUES (?, ?, ?, ?)",
      )
      .bind("org-2", "acme", "active", "2026-01-01")
      .run(),
  );
});

test("harness: SELECT with WHERE = ?", async () => {
  const env = createTestEnv();
  await env.KEYS_DB.prepare(
    "INSERT INTO organizations (id, slug, status, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind("org-1", "acme", "active", "2026-01-01")
    .run();
  await env.KEYS_DB.prepare(
    "INSERT INTO organizations (id, slug, status, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind("org-2", "beta", "active", "2026-01-01")
    .run();
  const stmt = env.KEYS_DB.prepare("SELECT id, slug FROM organizations WHERE slug = ?").bind("acme");
  const row = await stmt.first<{ id: string; slug: string }>();
  assert.equal(row?.id, "org-1");
});

test("harness: UPDATE", async () => {
  const env = createTestEnv();
  await env.KEYS_DB.prepare(
    "INSERT INTO organizations (id, slug, status, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind("org-1", "acme", "active", "2026-01-01")
    .run();
  await env.KEYS_DB.prepare("UPDATE organizations SET status = ? WHERE id = ?")
    .bind("suspended", "org-1")
    .run();
  const rows = await selectAll(env, "organizations");
  assert.equal(rows[0].status, "suspended");
});

test("harness: KV put/get/ttl/delete", async () => {
  const env = createTestEnv();
  await env.KEYS_KV.put("k", "v");
  assert.equal(await env.KEYS_KV.get("k"), "v");
  await env.KEYS_KV.delete("k");
  assert.equal(await env.KEYS_KV.get("k"), null);
});

test("harness: R2 put/get/list", async () => {
  const env = createTestEnv();
  await env.KEYS_R2.put("artifact/1", "hello");
  const obj = await env.KEYS_R2.get("artifact/1");
  assert.equal(await obj?.text(), "hello");
  const list = await env.KEYS_R2.list({ prefix: "artifact/" });
  assert.equal(list.objects.length, 1);
});
