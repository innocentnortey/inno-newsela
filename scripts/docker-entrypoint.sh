#!/bin/sh
# NL-23: optional migrate (owner credential, one-shot service only), optional runtime-role grants, then exec.
set -eu
if [ "${RUN_MIGRATIONS:-}" = "1" ]; then
  npm run db:migrate --silent
fi
if [ -n "${RUNTIME_DATABASE_URL:-}" ]; then
  node scripts/apply-runtime-grants.mjs
fi
exec "$@"
