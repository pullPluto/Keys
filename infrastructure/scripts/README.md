# Infrastructure scripts

This directory holds scripts an operator runs by hand. Nothing here
mutates Cloudflare state without an explicit, reviewed invocation.

## `provision-cloudflare.sh`

Creates the three named storage resources (`keys-pluto` D1 database,
KV namespace, R2 bucket), prints Cloudflare's returned identifiers,
and leaves configuration/deployment/migrations to a reviewed
operator. It may fail if resources already exist; inspect account
state before rerunning. It contains no cleanup command because
deleting control-plane storage is destructive and requires explicit
scope and recovery evidence.

## `apply-migrations.sh`

Applies the forward-only D1 migrations in `apps/worker/migrations/`
to the `keys-pluto` D1 database. The script does **not** create the
D1 database — run `provision-cloudflare.sh` first and copy the
returned ID into your local, gitignored `apps/worker/wrangler.jsonc`
or export `KEYS_PLUTO_DB_ID`.

Usage:

```sh
# Local (default, safe)
KEYS_PLUTO_DB_ID=<id-from-provision> infrastructure/scripts/apply-migrations.sh

# Remote (after the provision step has run in the target account)
KEYS_PLUTO_DB_ID=<id-from-provision> REMOTE=true \
  infrastructure/scripts/apply-migrations.sh
```

The script enforces the AGENTS.md forward-only contract by routing
through Wrangler's `d1 migrations apply`. It refuses to re-run a
file that is already in the D1 `d1_migrations` table, and it exits
non-zero with a recovery hint if Wrangler reports a failure. See
`apps/worker/migrations/notes/<migration-name>.recovery.md` for the
per-migration recovery note and
[`docs/operations/backups.md`](../../docs/operations/backups.md) for
how to inspect the journal.

Forward-only shape is verified locally by `npm run check:migrations`
(see [`tests/migration-shape.test.ts`](../../tests/migration-shape.test.ts)).
Run that command in CI and in pre-commit before pushing a new
migration.

The MVP script targets the dev/staging worker only. Production
deployment must use a reviewed Wrangler config and the operator
sequence in [`docs/operations/deployment.md`](../../docs/operations/deployment.md).
