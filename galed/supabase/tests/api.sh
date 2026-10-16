#!/usr/bin/env bash
# Runs src/backend/live.ts against a real PostgREST + Postgres 16 with the
# migration applied. Needs the postgrest binary (https://postgrest.org) on
# PATH or in $POSTGREST. Usage: supabase/tests/api.sh [work-dir]
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
app="$here/../.."
bin="${PG_BIN:-/usr/lib/postgresql/16/bin}"
postgrest="${POSTGREST:-postgrest}"
work="${1:-$(mktemp -d)}"
data="$work/pgdata"
port="${PG_PORT:-54330}"
rest_port="${PGRST_PORT:-54331}"
export JWT_SECRET="local-test-secret-at-least-32-characters-long"

as=()
if [ "$(id -u)" = 0 ]; then
  chown -R postgres "$work"
  as=(runuser -u postgres --)
fi
"${as[@]}" "$bin/initdb" -D "$data" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
"${as[@]}" "$bin/pg_ctl" -D "$data" -o "-p $port -c listen_addresses=127.0.0.1 -c unix_socket_directories=''" -l "$work/pg.log" -w start >/dev/null
rest_pid=""
cleanup() {
  [ -n "$rest_pid" ] && kill "$rest_pid" 2>/dev/null || true
  "${as[@]}" "$bin/pg_ctl" -D "$data" -m immediate stop >/dev/null
}
trap cleanup EXIT

psql=(psql -X -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -U postgres -d postgres)
"${psql[@]}" -f "$here/stub_auth.sql"
for m in "$app"/supabase/migrations/*.sql; do "${psql[@]}" -f "$m"; done
"${psql[@]}" <<'SQL'
create role authenticator login noinherit;
grant anon, authenticated to authenticator;
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'alice@example.com'),
  ('b0000000-0000-0000-0000-000000000002', 'bob@example.com'),
  ('c0000000-0000-0000-0000-000000000003', 'carol@example.com');
SQL

PGRST_DB_URI="postgres://authenticator@127.0.0.1:$port/postgres" \
PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$JWT_SECRET" \
PGRST_SERVER_HOST=127.0.0.1 PGRST_SERVER_PORT="$rest_port" \
  "$postgrest" >"$work/postgrest.log" 2>&1 &
rest_pid=$!
for _ in $(seq 50); do
  curl -sf "http://127.0.0.1:$rest_port/" >/dev/null && break
  sleep 0.2
done

"$app/node_modules/.bin/esbuild" "$here/api.test.ts" --bundle --platform=node --format=esm \
  --define:import.meta.env.VITE_SUPABASE_URL='"unused"' --define:import.meta.env.VITE_SUPABASE_ANON_KEY='"unused"' \
  --log-level=warning --outfile="$work/api.test.mjs"
PGRST_PORT="$rest_port" node "$work/api.test.mjs"
