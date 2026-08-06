export interface Env {
  ENVIRONMENT: "development" | "staging" | "production";
  KEYS_DB: D1Database;
  KEYS_KV: KVNamespace;
  KEYS_R2: R2Bucket;
}

export interface D1Database {
  prepare(query: string): unknown;
}

export interface KVNamespace {
  get(key: string): Promise<string | null>;
}

export interface R2Bucket {
  get(key: string): Promise<unknown>;
}
