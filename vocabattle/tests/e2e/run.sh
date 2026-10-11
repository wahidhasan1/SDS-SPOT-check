#!/usr/bin/env bash
# Full E2E run: fresh database → web build → dev gateway → browser journeys.
#   BUILD=0 ./e2e/run.sh   to reuse an existing mobile/dist
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
TESTS="$(cd "$HERE/.." && pwd)"
ROOT="$(cd "$TESTS/.." && pwd)"
PORT="${GATEWAY_PORT:-8787}"

"$TESTS/db/reset.sh" >/dev/null
if [ "${BUILD:-1}" = "1" ]; then
  (cd "$ROOT/mobile" && CI=1 EXPO_OFFLINE=1 EXPO_PUBLIC_SUPABASE_URL="http://localhost:$PORT" EXPO_PUBLIC_SUPABASE_ANON_KEY=dev-anon-key \
    npx expo export --platform web >/dev/null)
fi
STATIC_DIR="$ROOT/mobile/dist" GATEWAY_PORT="$PORT" node "$TESTS/dev-gateway.mjs" > "${GATEWAY_LOG:-/tmp/vocabattle-gateway.log}" 2>&1 &
GW=$!
trap 'kill $GW 2>/dev/null || true' EXIT
for _ in $(seq 1 50); do curl -s "localhost:$PORT/auth/v1/settings" >/dev/null && break; sleep 0.2; done
APP_URL="http://localhost:$PORT" node "$HERE/journeys.mjs"
