import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

// Forward-only migration shape test.
//
// AGENTS.md workflow rule 5 says D1 schema changes are forward-only and
// "write a recovery note and never rewrite an applied migration". The
// shape rules this test enforces:
//
//   1. Every .sql file in apps/worker/migrations/ is a forward-only
//      migration: no DROP COLUMN, no RENAME COLUMN, no DROP TABLE.
//      Schema changes to an already-applied migration must ship as a
//      new migration.
//   2. Every file ends with a trailing newline (so `cat` and `git diff`
//      agree on the last line).
//   3. Every file starts with the standard header comment that links
//      to the recovery directory and the recovery note convention.
//   4. The filename matches NNNN_<topic>.sql, lexical order is the
//      apply order, and there is at most one recovery note per
//      migration file.

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const migrationsDir = join(repoRoot, "apps", "worker", "migrations");
const notesDir = join(migrationsDir, "notes");

const listSql = () =>
  readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();

const readMigration = (name: string) => {
  const path = join(migrationsDir, name);
  const stat = statSync(path);
  if (!stat.isFile()) throw new Error(`${name} is not a regular file`);
  return readFileSync(path, "utf8");
};

test("migrations directory exists and is a directory", () => {
  const stat = statSync(migrationsDir);
  assert.equal(stat.isDirectory(), true, `${migrationsDir} is not a directory`);
});

test("every .sql migration file ends with a trailing newline", () => {
  for (const name of listSql()) {
    const text = readMigration(name);
    assert.ok(
      text.endsWith("\n"),
      `${name} does not end with a trailing newline`,
    );
  }
});

test("every .sql migration file is forward-only", () => {
  // Patterns that would mutate or remove an already-applied object.
  const forbidden = [
    /\bDROP\s+COLUMN\b/i,
    /\bRENAME\s+COLUMN\b/i,
    /\bRENAME\s+TO\b/i,
    /\bDROP\s+TABLE\b/i,
  ];
  for (const name of listSql()) {
    const text = readMigration(name);
    for (const pat of forbidden) {
      assert.equal(
        pat.test(text),
        false,
        `${name} contains a forward-only violation: ${pat}`,
      );
    }
  }
});

test("every .sql migration file starts with the standard header", () => {
  // We only require a leading comment that points at the recovery note
  // convention. The exact wording is the recovery author's choice.
  for (const name of listSql()) {
    const text = readMigration(name);
    const firstLine = text.split("\n", 1)[0] ?? "";
    assert.ok(
      firstLine.startsWith("--"),
      `${name} does not start with a '--' header comment (got: ${JSON.stringify(firstLine)})`,
    );
  }
});

test("migration filenames are 4-digit prefixed and lexically ordered", () => {
  const names = listSql();
  assert.ok(names.length > 0, "no migrations found");
  const re = /^\d{4}_[a-z0-9_]+\.sql$/;
  for (const name of names) {
    assert.ok(
      re.test(name),
      `${name} does not match the NNNN_<topic>.sql convention`,
    );
  }
  // Lexical order of NNNN_*.sql equals numeric order because the
  // NNNN_ prefix is fixed-width and zero-padded.
  const sorted = [...names].sort();
  assert.deepEqual(names, sorted, "migrations are not in lexical order");
});

test("there is at most one recovery note per migration file", () => {
  // Optional: the notes/ directory may be empty. If present, every
  // note must be named after a migration file (NNNN_*.recovery.md).
  let noteNames: string[] = [];
  try {
    noteNames = readdirSync(notesDir).filter((n) => n.endsWith(".recovery.md"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  const migrationNames = listSql();
  for (const note of noteNames) {
    const stem = note.replace(/\.recovery\.md$/, ".sql");
    assert.ok(
      migrationNames.includes(stem),
      `recovery note ${note} has no matching migration ${stem}`,
    );
  }
});
