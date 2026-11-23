#!/usr/bin/env bash
# Runs the migrations and permission tests against a throwaway local Postgres.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
DATA="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
if [ "$(id -u)" = "0" ]; then RUN="runuser -u postgres --"; chown postgres "$DATA"; else RUN=""; fi
cleanup() { $RUN "$PGBIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; }
trap cleanup EXIT
$RUN "$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
$RUN "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp" -l "$DATA/log" start >/dev/null
sleep 1
PSQL=(psql -h /tmp -p "$PORT" -U postgres -d postgres -q -v ON_ERROR_STOP=1)
"${PSQL[@]}" -f "$HERE/local_auth_stub.sql"
for f in "$HERE"/../migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -c "grant select, insert, update, delete on all tables in schema public to authenticated; grant usage, select on all sequences in schema public to authenticated; grant select on all tables in schema public to anon;"
OUT="$(psql -h /tmp -p "$PORT" -U postgres -d postgres -f "$HERE/permissions_test.sql" 2>&1)"
echo "$OUT" | grep -E "PASS|FAIL|ERROR|passed|^ +[0-9]" || true
if echo "$OUT" | grep -qE "FAIL|ERROR"; then echo "Some tests failed"; exit 1; fi
echo "All permission tests passed"
