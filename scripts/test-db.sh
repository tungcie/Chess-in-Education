#!/usr/bin/env bash
# Chạy migration + test phân quyền pgTAP trên một Postgres tạm (không cần Docker).
# Cần: Postgres 15+ (initdb, pg_ctl), pgTAP, pg_prove.  Dùng: npm run test:db
# Có Supabase CLI + Docker thì dùng `supabase test db` cũng được — test viết chạy được cả hai nơi.
set -euo pipefail
cd "$(dirname "$0")/.."

PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
export PATH="$PG_BIN:$PATH"
DIR="$(pwd)/.tmp-db"
PORT="${PGPORT_TEST:-54329}"
rm -rf "$DIR"; mkdir -p "$DIR"

RUN_AS=()
if [ "$(id -u)" = "0" ]; then
  # initdb không chạy bằng root
  id pgtest >/dev/null 2>&1 || useradd -M pgtest
  chown -R pgtest "$DIR"
  RUN_AS=(runuser -u pgtest --)
fi

"${RUN_AS[@]}" initdb -D "$DIR/data" -U postgres -A trust >/dev/null
"${RUN_AS[@]}" pg_ctl -D "$DIR/data" -o "-p $PORT -k $DIR -c listen_addresses=''" -l "$DIR/log" -w start >/dev/null
trap '"${RUN_AS[@]}" pg_ctl -D "$DIR/data" -m fast stop >/dev/null' EXIT

export PGHOST="$DIR" PGPORT="$PORT" PGUSER=postgres PGDATABASE=postgres
psql -q -v ON_ERROR_STOP=1 -c "alter database postgres set search_path = \"\$user\", public, extensions" >/dev/null
psql -q -v ON_ERROR_STOP=1 -f scripts/test-db/supabase-shim.sql >/dev/null

for f in supabase/migrations/*.sql; do
  echo "migration: $f"
  psql -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null
done

pg_prove --failures supabase/tests/*.sql
