# Recovery note — 0001_control_plane

**Status:** place-holder. Recovery owner is `TBD` and will be set when
[issue #22 (M4.1) Name a backup break-glass
administrator](https://github.com/pullPluto/Keys/issues/22) lands.

## What this migration creates

`apps/worker/migrations/0001_control_plane.sql` creates the durable
control-plane foundation:

- `organizations`
- `identities`
- `clients`
- `policy_documents`
- `audit_events`
- supporting indexes

It is the only source of truth for the control-plane record. KV is
disposable acceleration; R2 is artifact retention. Neither is a
substitute for any column in this migration. See
[`docs/architecture/overview.md`](../../../docs/architecture/overview.md).

## Forward-only contract

This migration is forward-only. Per the AGENTS.md workflow rule and
the forward-only test in
[`tests/migration-shape.test.ts`](../../../tests/migration-shape.test.ts):

- No `DROP COLUMN`, `RENAME COLUMN`, or other destructive ALTER
  against an already-applied migration.
- Any structural change requires a new migration file in this
  directory.
- Migrations apply in lexical order; never renumber an existing file.

## How to verify the migration is applied

After running [`infrastructure/scripts/apply-migrations.sh`](../../../infrastructure/scripts/apply-migrations.sh):

```sh
npx --workspace=@pullpluto/keys-worker wrangler d1 execute keys-pluto --local \
  --command "SELECT name FROM d1_migrations ORDER BY id"
```

You should see `0001_control_plane.sql` (and `0002_identity_issuer_foundation.sql`
if you have applied that one too).

## If a migration fails partway

1. **Do not re-run** the script. The Wrangler migration journal is
   append-only and re-running the same file is a no-op only if the
   previous attempt recorded a successful apply.
2. Inspect the D1 state with the `d1_migrations` table above.
3. Add a new forward migration to repair the partial state. Never
   edit a file that has already been applied to any environment.
4. Record the incident in `docs/operations/backups.md` (under
   "Restoration history") and link the issue that tracks the repair.

## Recovery owner (TBD)

This slot is currently empty. Until [issue #22 (M4.1)](https://github.com/pullPluto/Keys/issues/22)
is closed, the commissioning user is the de-facto owner and must be
consulted before any forward-only repair migration is added. After
M4.1 lands, the named backup break-glass administrator takes this
slot and the existing operators are removed from the recovery chain.

## Related backlog items

- [Issue #3 (M0.1) Wire D1 migration runner and seed bootstrap](https://github.com/pullPluto/Keys/issues/3) — the work that produced this note.
- [Issue #22 (M4.1) Name a backup break-glass administrator](https://github.com/pullPluto/Keys/issues/22) — names the owner.
- [Issue #23 (M4.2) Approve retention periods and data classification](https://github.com/pullPluto/Keys/issues/23) — sets the retention numbers referenced by `audit_events`.
- [Issue #27 (M4.6) Incident response runbook](https://github.com/pullPluto/Keys/issues/27) — the on-call process for the failure path above.
