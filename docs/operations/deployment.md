# Deployment

## Preconditions

An accountable service owner must supply the Cloudflare account, environments, custom domains, secret-management procedure, approval gate, and rollback owner. Production deployment is blocked until the security and recovery decisions in this repository have evidence.

## Operator sequence

1. Create the D1 database, KV namespace, and R2 bucket with the exact `keys-pluto` names using `infrastructure/scripts/provision-cloudflare.sh`.
2. Copy the Wrangler template locally; insert returned IDs without committing it.
3. Review the migration, then apply it to the intended D1 environment using [`infrastructure/scripts/apply-migrations.sh`](../infrastructure/scripts/apply-migrations.sh) (or Wrangler's D1 migration command directly). The script defaults to `--local`; set `REMOTE=true` for the remote D1 after a confirmation prompt.
4. Set non-secret variables and secret bindings through an approved Cloudflare environment, never through source control.
5. Run type checks and tests; deploy through the approved CI identity once it exists.
6. Verify `GET /healthz`, review worker/error telemetry, and retain the deploy reference for rollback.

## Rollback

Roll back Worker code to the previous known-good deployment through the approved release mechanism. Do not roll back D1 by deleting tables or rewriting an applied migration; use a new forward migration or restore procedure. A restoration exercise has not been performed, so no recovery-time or recovery-point commitment is made.
