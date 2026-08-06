# Backups and recovery

D1 contains control-plane records and needs a tested export/restore strategy before production use. R2 retention and versioning configuration also require explicit owner decisions. KV data is intentionally non-authoritative and must be reconstructable from D1 or configuration.

Required before production:

- named recovery owner and recovery approval authority;
- data classification, backup frequency, retention, residency, and encryption requirements;
- D1 export/restore and R2 recovery procedures expressed as versioned operator commands;
- a documented tenant-safe restore plan and a recorded restoration exercise;
- recovery objectives backed by evidence.

None of the above is complete in this scaffold. Never delete a remote resource as a substitute for recovery.

The recovery owner and restoration exercise are tracked as Phase 4
issue M4.2 (retention and classification) and M4.6 (incident response)
in [`../decisions/backlog/mvp.md`](../decisions/backlog/mvp.md), which
name the ADRs to be created (`ADR-013-retention-and-classification.md`
and an incident-response ADR) in the same PRs as the decisions. The
MVP's migration runner ([issue #3 / M0.1](https://github.com/pullPluto/Keys/issues/3))
records a recovery note for the first applied migration before any
D1 changes ship.

## Inspecting the migration journal (dev/staging)

The MVP migration runner
([`infrastructure/scripts/apply-migrations.sh`](../../infrastructure/scripts/apply-migrations.sh))
uses Wrangler's built-in `d1 migrations apply` command, which records
each applied migration in the D1 `d1_migrations` table. After applying
migrations, verify the journal:

```sh
# Local (default)
npx --workspace=@pullpluto/keys-worker wrangler d1 execute keys-pluto --local \
  --command "SELECT name FROM d1_migrations ORDER BY id"

# Remote (after `wrangler d1 migrations apply ... --remote`)
npx --workspace=@pullpluto/keys-worker wrangler d1 execute keys-pluto --remote \
  --command "SELECT name FROM d1_migrations ORDER BY id"
```

If a migration appears in the journal but the schema is missing or
incomplete, **do not re-run the apply command**. Add a new forward
migration to repair the state, and record the incident in the
"Restoration history" section below.

### Recovery notes

Each applied migration may carry a recovery note at
`apps/worker/migrations/notes/<migration-name>.recovery.md`. The
recovery note records what the migration creates, the forward-only
contract, and the recovery owner (TBD until
[issue #22 (M4.1)](https://github.com/pullPluto/Keys/issues/22)
closes). Treat the note as the source of truth for what a migration
did — the `d1_migrations` table only records the filename.

### Restoration history

_(empty — append a row after the first restoration exercise)_
