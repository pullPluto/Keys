#!/usr/bin/env sh
# Applies the forward-only D1 migrations in apps/worker/migrations/ to the
# keys-pluto D1 database. This script is dev/staging-only; production
# deployment must use a reviewed Wrangler config and the operator sequence
# in docs/operations/deployment.md.
#
# It does NOT create the D1 database. Run infrastructure/scripts/
# provision-cloudflare.sh first; copy the returned database ID into your
# local, gitignored apps/worker/wrangler.jsonc.
#
# Required environment:
#   KEYS_PLUTO_DB_NAME  - D1 database name (default: keys-pluto)
#   KEYS_PLUTO_DB_ID    - D1 database ID (no default; required)
#
# Optional:
#   REMOTE             - "true" to apply to the remote D1, otherwise
#                        wrangler d1 migrations apply uses --local by
#                        default for safety. Pass "true" explicitly to
#                        target the remote database.
#
# Exit codes:
#   0  every migration applied
#   1  precondition missing (npx, wrangler, DB id, migrations folder)
#   2  wrangler reported a failure on a migration
set -eu

# --- preconditions -----------------------------------------------------------
if ! command -v npx >/dev/null 2>&1; then
  echo "error: npx is required (Node.js 22+)" >&2
  exit 1
fi

DB_NAME="${KEYS_PLUTO_DB_NAME:-keys-pluto}"
DB_ID="${KEYS_PLUTO_DB_ID:-}"
if [ -z "$DB_ID" ]; then
  echo "error: KEYS_PLUTO_DB_ID is not set" >&2
  echo "hint:  run infrastructure/scripts/provision-cloudflare.sh," >&2
  echo "       then put the returned ID in your local" >&2
  echo "       apps/worker/wrangler.jsonc or export KEYS_PLUTO_DB_ID." >&2
  exit 1
fi

# Find the migrations folder. We look relative to this script, then to the
# repo root, so the script works whether you call it from the repo root or
# from inside infrastructure/scripts/.
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
MIGRATIONS_DIR="$REPO_ROOT/apps/worker/migrations"
if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "error: migrations directory not found at $MIGRATIONS_DIR" >&2
  exit 1
fi

# --- confirm remote intent ---------------------------------------------------
TARGET_FLAG="--local"
if [ "${REMOTE:-}" = "true" ]; then
  TARGET_FLAG="--remote"
  echo "warning: applying migrations to REMOTE database '$DB_NAME' ($DB_ID)" >&2
  printf "Press Enter to continue, Ctrl-C to abort: " >&2
  read -r _
fi

# --- apply ------------------------------------------------------------------
# We use wrangler's built-in migration command rather than a hand-rolled SQL
# loop so Wrangler tracks the migration journal in the D1 metadata table.
echo "applying migrations from $MIGRATIONS_DIR to $DB_NAME ($TARGET_FLAG)"
if ! npx --workspace=@pullpluto/keys-worker wrangler d1 migrations apply "$DB_NAME" \
    --config "$REPO_ROOT/apps/worker/wrangler.example.jsonc" \
    $TARGET_FLAG; then
  echo "error: wrangler d1 migrations apply failed" >&2
  echo "       inspect D1 state and do not re-run; instead add a new" >&2
  echo "       forward migration under apps/worker/migrations/." >&2
  exit 2
fi

# --- post-condition ---------------------------------------------------------
echo "migrations applied. Inspect the D1 migration journal:"
echo "  npx --workspace=@pullpluto/keys-worker wrangler d1 execute $DB_NAME $TARGET_FLAG \\"
echo "    --command \"SELECT name FROM d1_migrations ORDER BY id\""
echo "Recovery notes for the first applied migration live in"
echo "  apps/worker/migrations/notes/<migration-name>.recovery.md"
echo "Recovery owner is TBD; see docs/operations/ownership.md and"
echo "issue #22 (M4.1) in docs/decisions/backlog/mvp.md."
