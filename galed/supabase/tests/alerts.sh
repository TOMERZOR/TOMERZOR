#!/usr/bin/env bash
# Runs the checkin-alerts edge function (Deno) against PostgREST + Postgres
# with a fake Twilio. Needs postgrest and deno on PATH (or $POSTGREST, $DENO).
# Usage: supabase/tests/alerts.sh [work-dir]
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
app="$here/../.."
bin="${PG_BIN:-/usr/lib/postgresql/16/bin}"
postgrest="${POSTGREST:-postgrest}"
deno="${DENO:-deno}"
work="${1:-$(mktemp -d)}"
port=54350; rest_port=54351; helper_port=54352; fn_port=8000 # Deno.serve default port
secret="local-test-secret-at-least-32-characters-long"

as=()
if [ "$(id -u)" = 0 ]; then
  chown -R postgres "$work"
  as=(runuser -u postgres --)
fi
"${as[@]}" "$bin/initdb" -D "$work/pgdata" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
"${as[@]}" "$bin/pg_ctl" -D "$work/pgdata" -o "-p $port -c listen_addresses=127.0.0.1 -c unix_socket_directories=''" -l "$work/pg.log" -w start >/dev/null
pids=()
cleanup() {
  for p in "${pids[@]}"; do kill "$p" 2>/dev/null || true; done
  pkill -f "$work/index.ts" 2>/dev/null || true # deno wrappers can leave the runtime behind
  "${as[@]}" "$bin/pg_ctl" -D "$work/pgdata" -m immediate stop >/dev/null
}
trap cleanup EXIT

psql=(psql -X -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -U postgres -d postgres)
"${psql[@]}" -f "$here/stub_auth.sql"
for m in "$app"/supabase/migrations/*.sql; do "${psql[@]}" -f "$m"; done
"${psql[@]}" <<'SQL'
create role authenticator login noinherit;
grant anon, authenticated, service_role to authenticator;
insert into auth.users (id) values
  ('a0000000-0000-0000-0000-000000000001'), ('b0000000-0000-0000-0000-000000000002'), ('c0000000-0000-0000-0000-000000000003');
update profiles set name = 'נועה ברק', gender = 'f' where id = 'a0000000-0000-0000-0000-000000000001';
update profiles set name = 'איתי לוי', gender = 'm' where id = 'b0000000-0000-0000-0000-000000000002';
update profiles set name = 'שירה', gender = 'f' where id = 'c0000000-0000-0000-0000-000000000003';
update private_settings set emergency_name = 'אמא', emergency_phone = '050-1234567' where user_id = 'a0000000-0000-0000-0000-000000000001';
update private_settings set emergency_phone = '050-0000000' where user_id = 'b0000000-0000-0000-0000-000000000002';
update private_settings set emergency_phone = '052-7654321' where user_id = 'c0000000-0000-0000-0000-000000000003';
insert into posts (id, author_id, trail_id, start_date, start_time, spots, pace, level, car, meet)
values ('11111111-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'ramon', current_date, '05:30', 3, 4.5, 'קשה', 'shuttle', 'מרכז המבקרים');
-- seed accepted members directly, past the request life-cycle trigger
alter table join_requests disable trigger join_requests_check;
insert into join_requests (post_id, user_id, status) values
  ('11111111-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'accepted'),
  ('11111111-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'accepted');
alter table join_requests enable trigger join_requests_check;
-- Noa and Itai are overdue (Itai's contact number will fail); Shira is still within her time.
insert into checkins (user_id, post_id, return_by) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', now() - interval '1 hour'),
  ('b0000000-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', now() - interval '1 hour'),
  ('c0000000-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', now() + interval '1 hour');
SQL

PGRST_DB_URI="postgres://authenticator@127.0.0.1:$port/postgres" PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon \
PGRST_JWT_SECRET="$secret" PGRST_SERVER_HOST=127.0.0.1 PGRST_SERVER_PORT=$rest_port \
  "$postgrest" >"$work/postgrest.log" 2>&1 &
pids+=($!)
node "$here/alerts-helper.mjs" $rest_port $helper_port "$work/sms.json" >"$work/helper.log" 2>&1 &
pids+=($!)

service_jwt=$(node -e '
const c = require("node:crypto"), b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const h = b({ alg: "HS256", typ: "JWT" }), p = b({ role: "service_role", exp: Math.floor(Date.now() / 1000) + 600 });
console.log(`${h}.${p}.${c.createHmac("sha256", process.argv[1]).update(`${h}.${p}`).digest("base64url")}`);' "$secret")

cp "$app/supabase/functions/checkin-alerts/"*.ts "$work/"
echo '{"nodeModulesDir":"auto"}' > "$work/deno.json"
(cd "$work" && SUPABASE_URL="http://127.0.0.1:$helper_port" SUPABASE_SERVICE_ROLE_KEY="$service_jwt" CRON_SECRET=cron-test \
  TWILIO_ACCOUNT_SID=AC123 TWILIO_AUTH_TOKEN=tok TWILIO_FROM=+15550001111 TWILIO_API_BASE="http://127.0.0.1:$helper_port/twilio" \
  "$deno" run --allow-net --allow-env "$work/index.ts" >"$work/fn.log" 2>&1) &
pids+=($!)
for _ in $(seq 100); do curl -s -o /dev/null "http://127.0.0.1:$fn_port/" && curl -s -o /dev/null "http://127.0.0.1:$rest_port/" && break; sleep 0.3; done

fail=0
check() { if [ "$1" = "$2" ]; then echo "  ok   $3"; else echo "  FAIL $3 (got: $1)"; fail=1; fi; }

check "$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1:$fn_port/")" 403 "rejects calls without the cron secret"
run1=$(curl -s -X POST -H 'x-cron-secret: cron-test' "http://127.0.0.1:$fn_port/")
check "$run1" '{"sent":1,"retry":1,"noPhone":[]}' "first run: one sent, one failed send queued for retry"
check "$(node -e 'const s=require(process.argv[1]); console.log(s.length, s[0].to, s[0].body.includes("נועה ברק יצאה למכתש רמון"), s[0].auth.startsWith("Basic "))' "$work/sms.json")" \
  "1 +972501234567 true true" "SMS went to Noa's contact, in E.164, with the right text"
q() { "${psql[@]}" -At -c "$1"; }
check "$(q "select string_agg(status, ',' order by user_id) from checkins")" "alerted,scheduled,scheduled" "Noa alerted, Itai released for retry, Shira untouched"
run2=$(curl -s -X POST -H 'x-cron-secret: cron-test' "http://127.0.0.1:$fn_port/")
check "$run2" '{"sent":0,"retry":1,"noPhone":[]}' "second run does not text Noa's contact again"

# Noa marks herself back: her contact gets an all-clear on the next run.
q "update checkins set status = 'returned' where user_id = 'a0000000-0000-0000-0000-000000000001'" >/dev/null
run3=$(curl -s -X POST -H 'x-cron-secret: cron-test' "http://127.0.0.1:$fn_port/")
check "$run3" '{"sent":1,"retry":1,"noPhone":[]}' "all-clear sent after Noa is back"
check "$(node -e 'const s=require(process.argv[1]); console.log(s.length, s[1].body.startsWith("גלעד: נועה סימנה שחזרה"))' "$work/sms.json")" "2 true" "all-clear text"

[ "$fail" = 0 ] && echo "all alert tests passed" || { echo "alert tests failed; logs in $work"; exit 1; }
