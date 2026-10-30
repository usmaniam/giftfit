#!/bin/sh
# Production entrypoint (Docker / Fly): create the schema, seed the catalog, then serve.
set -e
mkdir -p "${STORAGE_DIR:-./storage}"

# Invite links are signed with a secret. If none is provided, generate one once and keep it
# next to the data so links survive restarts.
if [ -z "$INVITE_TOKEN_SECRET" ]; then
  f="${SECRET_FILE:-./.invite-secret}"
  if [ ! -s "$f" ]; then
    (umask 077; node -e "process.stdout.write(require('crypto').randomBytes(24).toString('hex'))" > "$f")
  fi
  INVITE_TOKEN_SECRET="$(cat "$f")"
  export INVITE_TOKEN_SECRET
fi

pnpm db:push --force   # create/upgrade tables
pnpm seed              # idempotent catalog upsert + labeled demo merchant data
exec pnpm exec next start -H 0.0.0.0 -p "${PORT:-3000}"
