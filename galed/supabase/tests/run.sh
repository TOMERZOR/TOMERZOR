#!/usr/bin/env bash
# Runs the migration and the row-level-security tests against a throwaway
# local Postgres 16. Usage: supabase/tests/run.sh [work-dir]
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bin="${PG_BIN:-/usr/lib/postgresql/16/bin}"
work="${1:-$(mktemp -d)}"
data="$work/pgdata"
port="${PG_PORT:-54329}"
# initdb refuses to run as root; use the postgres system user when we are root
as=()
if [ "$(id -u)" = 0 ]; then
  chown -R postgres "$work"
  as=(runuser -u postgres --)
fi
"${as[@]}" "$bin/initdb" -D "$data" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
"${as[@]}" "$bin/pg_ctl" -D "$data" -o "-p $port -c listen_addresses=127.0.0.1 -c unix_socket_directories=''" -l "$work/pg.log" -w start >/dev/null
trap '"${as[@]}" "$bin/pg_ctl" -D "$data" -m immediate stop >/dev/null' EXIT
psql=(psql -X -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -U postgres -d postgres)
"${psql[@]}" -f "$here/stub_auth.sql"
for m in "$here"/../migrations/*.sql; do "${psql[@]}" -f "$m"; done
"${psql[@]}" -o /dev/null -f "$here/rls_test.sql"
"${psql[@]}" -o /dev/null -f "$here/checkins_test.sql"
echo "all database tests passed"
