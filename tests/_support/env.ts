// tests/_support/env.ts
//
// In-memory Cloudflare bindings for the test harness. The Worker route
// handlers are written against the standard @cloudflare/workers-types
// D1/KV/R2 surface, so the test harness can build a structurally
// compatible Env without talking to Cloudflare.
//
// D1: a hand-rolled SQL subset that supports the queries the MVP
//     code actually runs: INSERT ... ON CONFLICT, SELECT ... WHERE,
//     UPDATE ... WHERE, DELETE ... WHERE. No joins, no subqueries.
//     Statements must be uppercased identifiers; bindings are
//     positional. This is intentionally narrow.
//
// KV: a Map-backed key/value store with TTL support.
//
// R2: a Map-backed object store.
//
// The schema is loaded from apps/worker/migrations/*.sql at harness
// construction so the test database is shaped exactly like the
// real one.

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// --- Cloudflare binding shims ----------------------------------------------

/** The minimal D1 surface the MVP code uses. */
export interface D1PreparedStatement {
  bind(...params: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean; meta: { changes: number } }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec?(query: string): Promise<{ count: number }>;
}

export interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface R2Object {
  body: ReadableStream<Uint8Array> | null;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
  put(key: string, value: string | ArrayBuffer | Uint8Array): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts?: { prefix?: string }): Promise<{ objects: { key: string }[] }>;
}

/** The Env shape the Worker code imports. */
export interface TestEnv {
  ENVIRONMENT: "development" | "staging" | "production";
  KEYS_DB: D1Database;
  KEYS_KV: KVNamespace;
  KEYS_R2: R2Bucket;
  MVP_BOOTSTRAP_ADMINS?: string; // JSON array of identity subjects
  MVP_HMAC_SECRET?: string; // dev HMAC secret; default for tests
  AUTHORIZATION_CACHE?: "true" | "false";
}

// --- In-memory D1 ----------------------------------------------------------

interface Row {
  [column: string]: unknown;
}

interface TableSchema {
  name: string;
  columns: { name: string; type: string; notNull: boolean; pk: boolean }[];
  // Column-level UNIQUE / composite UNIQUE captured as a list of column sets.
  uniques: string[][];
}

class InMemoryD1 implements D1Database {
  private tables = new Map<string, TableSchema>();
  private rows = new Map<string, Row[]>();

  totalRowCount(): number {
    let n = 0;
    for (const rows of this.rows.values()) n += rows.length;
    return n;
  }

  loadSchema(sql: string): void {
    // Parse CREATE TABLE statements only. We do not need ALTER/DROP for
    // the MVP tests; the migration-shape test forbids them on already-
    // applied migrations, so they cannot appear in a fresh load.
    const createRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(([^;]+)\)\s*;?/gi;
    let m: RegExpExecArray | null;
    while ((m = createRe.exec(sql)) !== null) {
      const name = m[1].toLowerCase();
      const body = m[2];
      const columns: TableSchema["columns"] = [];
      const uniques: string[][] = [];
      for (const rawLine of body.split(",")) {
        const line = rawLine.trim();
        if (!line) continue;
        if (/^PRIMARY\s+KEY/i.test(line)) {
          // PRIMARY KEY (col1, col2) — capture into uniques
          const inner = line.match(/\(([^)]+)\)/);
          if (inner) {
            uniques.push(inner[1].split(",").map((c) => c.trim().toLowerCase()));
          }
          continue;
        }
        if (/^UNIQUE/i.test(line)) {
          const inner = line.match(/\(([^)]+)\)/);
          if (inner) {
            uniques.push(inner[1].split(",").map((c) => c.trim().toLowerCase()));
          }
          continue;
        }
        if (/^CHECK/i.test(line) || /^FOREIGN\s+KEY/i.test(line)) {
          // Constraints we don't model. The DDL parsing is best-effort.
          continue;
        }
        const parts = line.split(/\s+/);
        const colName = parts[0].toLowerCase();
        const colType = parts.slice(1).join(" ").toLowerCase();
        const notNull = /not\s+null/i.test(colType);
        const isPk = /primary\s+key/i.test(colType);
        const isUnique = /\bUNIQUE\b/i.test(colType);
        columns.push({ name: colName, type: colType, notNull, pk: isPk });
        if (isUnique) {
          // Inline UNIQUE on a single column. Record it as a 1-column
          // unique set so conflict detection covers it.
          uniques.push([colName]);
        }
      }
      this.tables.set(name, { name, columns, uniques });
      if (!this.rows.has(name)) this.rows.set(name, []);
    }

    // Parse CREATE INDEX (capture only, the in-memory store does not
    // require indexes for the MVP query set).
    void /CREATE\s+INDEX/; // marker so the linter doesn't strip the regex above
  }

  getTable(name: string): { schema: TableSchema; rows: Row[] } {
    const schema = this.tables.get(name.toLowerCase());
    if (!schema) throw new Error(`unknown table: ${name}`);
    return { schema, rows: this.rows.get(name.toLowerCase())! };
  }

  prepare(query: string): D1PreparedStatement {
    return new InMemoryStatement(this, query.trim());
  }
}

class InMemoryStatement implements D1PreparedStatement {
  private params: unknown[] = [];
  constructor(
    private db: InMemoryD1,
    private query: string,
  ) {}
  bind(...params: unknown[]): D1PreparedStatement {
    this.params = params;
    return this;
  }
  async first<T = unknown>(): Promise<T | null> {
    const rows = await this.all<T>();
    return rows.results[0] ?? null;
  }
  async all<T = unknown>(): Promise<{ results: T[] }> {
    const q = this.query;
    if (/^SELECT/i.test(q)) {
      const rows = this.execSelect(q) as T[];
      return { results: rows };
    }
    if (/^INSERT/i.test(q)) {
      this.execInsert(q);
      return { results: [] as T[] };
    }
    if (/^UPDATE/i.test(q)) {
      this.execUpdate(q);
      return { results: [] as T[] };
    }
    if (/^DELETE/i.test(q)) {
      this.execDelete(q);
      return { results: [] as T[] };
    }
    throw new Error(`unsupported query: ${q.slice(0, 80)}`);
  }
  async run(): Promise<{ success: boolean; meta: { changes: number } }> {
    const before = this.totalRows();
    if (/^INSERT/i.test(this.query)) this.execInsert(this.query);
    else if (/^UPDATE/i.test(this.query)) this.execUpdate(this.query);
    else if (/^DELETE/i.test(this.query)) this.execDelete(this.query);
    else throw new Error(`unsupported run(): ${this.query.slice(0, 80)}`);
    const changes = this.totalRows() - before;
    return { success: true, meta: { changes } };
  }

  private totalRows(): number {
    return this.db.totalRowCount();
  }

  private execSelect(q: string): unknown[] {
    // SELECT cols FROM table [WHERE cond]
    const m = q.match(/^SELECT\s+([\s\S]+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+([\s\S]+))?$/i);
    if (!m) throw new Error(`bad SELECT: ${q}`);
    const cols = m[1].trim();
    const tableName = m[2];
    const where = m[3]?.trim();
    const { schema, rows } = this.db.getTable(tableName);
    let result = rows.slice();
    if (where) {
      result = result.filter((r) => evalWhere(where, r, this.params, schema));
    }
    if (cols !== "*") {
      const wanted = cols.split(",").map((c) => c.trim());
      result = result.map((r) => {
        const out: Row = {};
        for (const w of wanted) out[w] = r[w];
        return out;
      });
    }
    return result;
  }

  private execInsert(q: string): void {
    // INSERT INTO table (cols) VALUES (?, ?, ?) [ON CONFLICT DO NOTHING]
    const m = q.match(
      /^INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([\s\S]+?)\)(?:\s+ON\s+CONFLICT\s+([\s\S]+))?$/i,
    );
    if (!m) throw new Error(`bad INSERT: ${q}`);
    const tableName = m[1];
    const cols = m[2].split(",").map((c) => c.trim().toLowerCase());
    const placeholders = m[3].split(",").map((c) => c.trim());
    if (placeholders.length !== this.params.length) {
      throw new Error(
        `INSERT placeholder count ${placeholders.length} != params ${this.params.length}: ${q}`,
      );
    }
    const { schema, rows } = this.db.getTable(tableName);
    const row: Row = {};
    for (let i = 0; i < cols.length; i++) row[cols[i]] = this.params[i];

    // ON CONFLICT handling.
    const onConflict = m[4]?.trim();
    if (onConflict) {
      if (!/DO\s+NOTHING/i.test(onConflict)) {
        throw new Error(`unsupported ON CONFLICT clause: ${onConflict}`);
      }
      if (this.uniqueConflict(row, schema, rows)) return;
    } else {
      // PRIMARY KEY conflict check (without explicit ON CONFLICT).
      if (this.pkConflict(row, schema, rows)) {
        throw new Error(`PRIMARY KEY conflict on ${tableName}`);
      }
      if (this.uniqueConflict(row, schema, rows)) {
        throw new Error(`UNIQUE conflict on ${tableName}`);
      }
    }
    rows.push(row);
  }

  private execUpdate(q: string): void {
    // UPDATE table SET col = ?, ... WHERE cond
    const m = q.match(/^UPDATE\s+(\w+)\s+SET\s+([\s\S]+?)(?:\s+WHERE\s+([\s\S]+))?$/i);
    if (!m) throw new Error(`bad UPDATE: ${q}`);
    const tableName = m[1];
    const sets = m[2].split(",").map((c) => c.trim());
    const where = m[3]?.trim();
    const { schema, rows } = this.db.getTable(tableName);
    let paramIndex = 0;
    const updates: { col: string; val: unknown }[] = [];
    for (const s of sets) {
      const eq = s.split("=").map((c) => c.trim());
      const col = eq[0].toLowerCase();
      if (eq[1] === "?") {
        updates.push({ col, val: this.params[paramIndex++] });
      } else {
        // Strip surrounding single quotes from a string literal.
        const lit = eq[1];
        const m = lit.match(/^'([^']*)'$/);
        updates.push({ col, val: m ? m[1] : lit });
      }
    }
    const matches = where ? rows.filter((r) => evalWhere(where, r, this.params.slice(paramIndex), schema)) : rows;
    for (const r of matches) {
      for (const u of updates) r[u.col] = u.val;
    }
  }

  private execDelete(q: string): void {
    const m = q.match(/^DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+([\s\S]+))?$/i);
    if (!m) throw new Error(`bad DELETE: ${q}`);
    const tableName = m[1];
    const where = m[2]?.trim();
    const { schema, rows } = this.db.getTable(tableName);
    if (!where) {
      rows.length = 0;
      return;
    }
    const keep = rows.filter((r) => !evalWhere(where, r, this.params, schema));
    rows.length = 0;
    rows.push(...keep);
  }

  private pkConflict(row: Row, schema: TableSchema, rows: Row[]): boolean {
    const pkCols = schema.columns.filter((c) => c.pk).map((c) => c.name);
    if (pkCols.length === 0) return false;
    return rows.some((r) => pkCols.every((c) => r[c] === row[c]));
  }

  private uniqueConflict(row: Row, schema: TableSchema, rows: Row[]): boolean {
    for (const uq of schema.uniques) {
      if (rows.some((r) => uq.every((c) => r[c] === row[c]))) return true;
    }
    return false;
  }
}

/** Evaluate a simple WHERE clause. Supports:
 *  - col = ?   (and = 'literal')
 *  - col IS NULL / IS NOT NULL
 *  - AND
 *  - parenthesized groups
 *  No OR, no LIKE, no IN, no operators other than = and IS.
 *  This is what the MVP code actually emits.
 *
 *  `params` is a stateful array; each `?` consumes one element.
 *  The `paramsIndex` arg tracks the start position. The function is
 *  pure for the row + WHERE; the params index advances left-to-right
 *  via a small wrapper class. */
function evalWhere(cond: string, row: Row, params: unknown[], _schema: TableSchema): boolean {
  const cursor = { i: 0 };
  return evalWhereInner(cond, row, params, cursor, _schema);
}

function evalWhereInner(
  cond: string,
  row: Row,
  params: unknown[],
  cursor: { i: number },
  _schema: TableSchema,
): boolean {
  while (cond.startsWith("(") && cond.endsWith(")")) cond = cond.slice(1, -1);
  const parts = splitAnd(cond);
  return parts.every((p) => evalAtom(p.trim(), row, params, cursor, _schema));
}

function splitAnd(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(") depth++;
    if (c === ")") depth--;
    if (depth === 0 && i + 5 <= s.length && /\s+AND\s+/i.test(s.slice(i, i + 5))) {
      out.push(buf);
      buf = "";
      i += 4;
      continue;
    }
    buf += c;
  }
  if (buf) out.push(buf);
  return out;
}

function evalAtom(atom: string, row: Row, params: unknown[], cursor: { i: number }, _schema: TableSchema): boolean {
  if (atom.startsWith("(") && atom.endsWith(")")) {
    return evalWhereInner(atom.slice(1, -1), row, params, cursor, _schema);
  }
  const isMatch = atom.match(/^(\w+)\s+IS\s+(NOT\s+)?NULL$/i);
  if (isMatch) {
    const col = isMatch[1].toLowerCase();
    const isNull = row[col] === null || row[col] === undefined;
    return isMatch[2] ? !isNull : isNull;
  }
  const eqMatch = atom.match(/^(\w+)\s*=\s*(\?|'[^']*')$/);
  if (!eqMatch) throw new Error(`unsupported WHERE atom: ${atom}`);
  const col = eqMatch[1].toLowerCase();
  const rhs = eqMatch[2];
  if (rhs === "?") {
    if (cursor.i >= params.length) throw new Error("missing param for ?");
    const v = params[cursor.i++];
    return row[col] === v;
  }
  const lit = rhs.slice(1, -1);
  return String(row[col]) === lit;
}

// `evalWhere` references an unused schema param. Silence the linter.
const _schema: TableSchema = { name: "", columns: [], uniques: [] };
function _silence(): void {
  void _schema;
}
_silence();

// --- In-memory KV -----------------------------------------------------------

class InMemoryKV implements KVNamespace {
  private store = new Map<string, { value: string; expiresAt: number | null }>();
  async get(key: string): Promise<string | null> {
    const e = this.store.get(key);
    if (!e) return null;
    if (e.expiresAt !== null && e.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return e.value;
  }
  async put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> {
    const expiresAt = opts?.expirationTtl ? Date.now() + opts.expirationTtl * 1000 : null;
    this.store.set(key, { value, expiresAt });
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
  // Test helper.
  clear(): void {
    this.store.clear();
  }
}

// --- In-memory R2 -----------------------------------------------------------

class InMemoryR2 implements R2Bucket {
  private objects = new Map<string, Uint8Array>();
  async get(key: string): Promise<R2Object | null> {
    const data = this.objects.get(key);
    if (!data) return null;
    const text = new TextDecoder().decode(data);
    return {
      body: null,
      text: async () => text,
      arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    };
  }
  async put(key: string, value: string | ArrayBuffer | Uint8Array): Promise<void> {
    if (typeof value === "string") {
      this.objects.set(key, new TextEncoder().encode(value));
    } else if (value instanceof Uint8Array) {
      this.objects.set(key, value);
    } else {
      this.objects.set(key, new Uint8Array(value));
    }
  }
  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }
  async list(opts?: { prefix?: string }): Promise<{ objects: { key: string }[] }> {
    const prefix = opts?.prefix ?? "";
    return {
      objects: [...this.objects.keys()]
        .filter((k) => k.startsWith(prefix))
        .map((key) => ({ key })),
    };
  }
}

// --- Harness ----------------------------------------------------------------

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const migrationsDir = join(repoRoot, "apps", "worker", "migrations");

/** Load every .sql file under apps/worker/migrations/ into a fresh D1. */
function loadMigrations(d1: InMemoryD1): void {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    const sql = readFileSync(join(migrationsDir, f), "utf8");
    d1.loadSchema(sql);
  }
}

export interface CreateTestEnvOptions {
  environment?: "development" | "staging" | "production";
  bootstrapAdmins?: string[];
  hmacSecret?: string;
  authorizationCache?: boolean;
}

/** Build a complete TestEnv with a freshly-migrated in-memory D1. */
export function createTestEnv(opts: CreateTestEnvOptions = {}): TestEnv {
  const d1 = new InMemoryD1();
  loadMigrations(d1);
  const env: TestEnv = {
    ENVIRONMENT: opts.environment ?? "development",
    KEYS_DB: d1,
    KEYS_KV: new InMemoryKV(),
    KEYS_R2: new InMemoryR2(),
  };
  if (opts.bootstrapAdmins) env.MVP_BOOTSTRAP_ADMINS = JSON.stringify(opts.bootstrapAdmins);
  if (opts.hmacSecret) env.MVP_HMAC_SECRET = opts.hmacSecret;
  if (opts.authorizationCache !== undefined) {
    env.AUTHORIZATION_CACHE = opts.authorizationCache ? "true" : "false";
  }
  return env;
}

/** Look up the rows in a table for assertions. */
export async function selectAll(env: TestEnv, table: string): Promise<Row[]> {
  const stmt = env.KEYS_DB.prepare(`SELECT * FROM ${table}`);
  const result = await stmt.all<Row>();
  return result.results;
}

/** Look up one row by primary key for assertions. */
export async function selectOne(env: TestEnv, table: string, pkColumn: string, pk: unknown): Promise<Row | null> {
  const stmt = env.KEYS_DB.prepare(`SELECT * FROM ${table} WHERE ${pkColumn} = ?`).bind(pk);
  return stmt.first<Row>();
}
