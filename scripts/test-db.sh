#!/usr/bin/env bash
# Start/stop this project's test Postgres (127.0.0.1:55440) without needing the real secrets.
# usage: scripts/test-db.sh up|down   (uses `sudo -n docker` when the user has no Docker socket access)
set -euo pipefail
cd "$(dirname "$0")/.."
ENVS="DATABASE_URL=unused MIGRATE_DATABASE_URL=unused AUDIT_HASH_SALT=unused-test-salt-0000000000000000 COLLAB_INTERNAL_TOKEN=unused-test-token-000000000000000"
D="env $ENVS docker"; docker info >/dev/null 2>&1 || D="sudo -n env $ENVS docker"
C="$D compose -p newsela-test -f docker-compose.yml -f docker-compose.test.yml"
case "${1:-up}" in
  up) $C up -d postgres ;;
  down) $C stop postgres ;;
  *) echo "usage: $0 up|down" >&2; exit 2 ;;
esac
