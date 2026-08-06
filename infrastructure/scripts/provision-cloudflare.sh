#!/usr/bin/env sh
set -eu

# Creates named resources only. It never deploys code, applies migrations, or
# writes returned IDs into files. Requires an authenticated Wrangler session.
if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required" >&2
  exit 1
fi

echo "Creating D1 database: keys-pluto"
npx wrangler d1 create keys-pluto
echo "Creating KV namespace: keys-pluto"
npx wrangler kv namespace create keys-pluto
echo "Creating R2 bucket: keys-pluto"
npx wrangler r2 bucket create keys-pluto
echo "Copy the returned IDs into your ignored apps/worker/wrangler.jsonc."
