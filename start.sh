#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"; cd "$ROOT"
if [ ! -f .env ]; then echo "Missing .env; configure it before starting." >&2; exit 1; fi
while IFS= read -r line || [ -n "$line" ]; do
  line="${line%$'\r'}"
  [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=(.*)$ ]] || continue
  key="${BASH_REMATCH[1]}"; value="${BASH_REMATCH[2]}"
  if [[ "$value" == \"*\" && "$value" == *\" ]] || [[ "$value" == \'*\' && "$value" == *\' ]]; then
    value="${value:1:${#value}-2}"
  fi
  [[ -n "${!key+x}" ]] || export "$key=$value"
done < .env
BACKEND_PORT="${BACKEND_PORT:-3001}"; FRONTEND_PORT="${FRONTEND_PORT:-3000}"
if [ ! -d node_modules ]; then echo "Backend dependencies missing; run scripts/bootstrap.sh explicitly." >&2; exit 1; fi
for port in "$BACKEND_PORT" "$FRONTEND_PORT"; do if command -v lsof >/dev/null && lsof -ti ":$port" >/dev/null 2>&1; then echo "Port $port is already in use." >&2; exit 1; fi; done
BACKEND_PORT="$BACKEND_PORT" CLIENT_PORT="$FRONTEND_PORT" CLIENT_URL="http://127.0.0.1:$FRONTEND_PORT" node server/index.js & BACKEND_PID=$!
FRONTEND_PID=''
if [ -x web/node_modules/.bin/react-scripts ]; then
  (cd web && PORT="$FRONTEND_PORT" REACT_APP_API_URL="http://127.0.0.1:$BACKEND_PORT" BROWSER=none npm start) & FRONTEND_PID=$!
else
  echo "Frontend dependencies are not installed; starting the API only."
fi
cleanup() { [ -z "$FRONTEND_PID" ] || kill "$FRONTEND_PID" 2>/dev/null || true; kill "$BACKEND_PID" 2>/dev/null || true; }; trap cleanup EXIT INT TERM
wait
