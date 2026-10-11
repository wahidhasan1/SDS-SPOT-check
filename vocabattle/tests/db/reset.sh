#!/usr/bin/env bash
# Recreates a throwaway database, applies the Supabase shim and every
# migration in order. Requires a local PostgreSQL superuser connection.
set -euo pipefail
DB="${TEST_DB:-vocabattle_test}"
PSQL=(psql -v ON_ERROR_STOP=1 -q -X)
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
"${PSQL[@]}" -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB"
"${PSQL[@]}" -d "$DB" -f "$HERE/supabase_shim.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "applying $(basename "$f")"
  "${PSQL[@]}" -d "$DB" -f "$f"
done
echo "database $DB ready"
