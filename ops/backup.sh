#!/usr/bin/env bash
# WF-40 / PD-30: one verified custom-format pg_dump under git-ignored backups/, one `backup` ops_event.
# Secrets travel in the environment only, never in argv. Dump directory is fixed (no override).
set -euo pipefail
cd "$(dirname "$0")/.."
[ -n "${DATABASE_URL:-}" ] || { echo "backup: DATABASE_URL is not set" >&2; exit 2; }

# Parse the URL inside node (URL read from env, not argv); NUL-separated fields.
{
  IFS= read -r -d '' PGUSER && IFS= read -r -d '' PGPASSWORD && IFS= read -r -d '' PGHOST \
    && IFS= read -r -d '' PGPORT && IFS= read -r -d '' PGDATABASE
} < <(node -e '
  const u = new URL(process.env.DATABASE_URL);
  if (u.protocol !== "postgres:" && u.protocol !== "postgresql:") process.exit(2);
  const d = (s) => decodeURIComponent(s);
  process.stdout.write([d(u.username), d(u.password), u.hostname, u.port || "5432", d(u.pathname.replace(/^\//, ""))].join("\0") + "\0");
') || { echo "backup: DATABASE_URL is not a postgres URL" >&2; exit 2; }
export PGUSER PGPASSWORD PGHOST PGPORT PGDATABASE

umask 077
mkdir -p backups
chmod 700 backups
name="ls-$(date -u +%Y%m%dT%H%M%SZ)-$(head -c4 /dev/urandom | od -An -tx1 | tr -d ' \n').dump"
out="backups/$name"

container="${BACKUP_DOCKER_CONTAINER:-}"
docker_bin="${BACKUP_DOCKER:-docker}"
if [ -n "$container" ]; then
  # `-e NAME` without a value forwards it from the environment: not in argv. The container uses its unix socket.
  "$docker_bin" exec -i -e PGPASSWORD -e PGUSER -e PGDATABASE "$container" pg_dump --format=custom > "$out" \
    || { rm -f "$out"; echo "backup: dump failed" >&2; exit 1; }
else
  command -v pg_dump >/dev/null 2>&1 && command -v pg_restore >/dev/null 2>&1 \
    || { echo "backup: pg_dump not found (install postgresql-client or set BACKUP_DOCKER_CONTAINER)" >&2; exit 3; }
  pg_dump --format=custom --file "$out" || { rm -f "$out"; echo "backup: dump failed" >&2; exit 1; }
fi
chmod 600 "$out"

if [ -n "$container" ]; then
  listing="$("$docker_bin" exec -i "$container" pg_restore --list < "$out" 2>/dev/null)" || listing=""
else
  listing="$(pg_restore --list "$out" 2>/dev/null)" || listing=""
fi
[ -n "$listing" ] || { rm -f "$out"; echo "backup: verification failed" >&2; exit 1; }

size="$(stat -c %s "$out")"
sha="$(sha256sum "$out" | cut -d' ' -f1)"
npx tsx ops/record-event.ts backup ops "{\"path\":\"$out\",\"size\":$size,\"sha256\":\"$sha\"}" >/dev/null \
  || { echo "backup: event not recorded" >&2; exit 1; }
echo "backup ok $out $size $sha"
