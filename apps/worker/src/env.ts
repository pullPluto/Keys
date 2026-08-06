// apps/worker/src/env.ts
//
// The Cloudflare Worker binding shape. Mirrors what the
// `wrangler.example.jsonc` declares. The D1/KV/R2 interfaces are
// the subset the Worker code uses; the test harness in
// `tests/_support/env.ts` provides a structurally compatible
// in-memory implementation.

export interface Env {
  ENVIRONMENT: "development" | "staging" | "production";
  KEYS_DB: D1Database;
  KEYS_KV: KVNamespace;
  KEYS_R2: R2Bucket;
  /** JSON array of identity subjects (providerSubject) that may
   *  upload and activate policies in dev. M2.3 only. Phase 4
   *  removes this in favor of the role-assignment data model. */
  MVP_BOOTSTRAP_ADMINS?: string;
  /** HMAC secret for the dev credential verifier. M1.4. Phase 4
   *  replaces the verifier entirely (issue #28). */
  MVP_HMAC_SECRET?: string;
  /** When "true", the authorize route may cache decisions in KV
   *  with a 5 s TTL. The default is off. */
  AUTHORIZATION_CACHE?: "true" | "false";
}

export interface D1PreparedStatement {
  bind(...params: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    opts?: { expirationTtl?: number },
  ): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface R2Bucket {
  get(key: string): Promise<unknown>;
  put(key: string, value: string | ArrayBuffer | Uint8Array): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts?: { prefix?: string }): Promise<{ objects: { key: string }[] }>;
}
