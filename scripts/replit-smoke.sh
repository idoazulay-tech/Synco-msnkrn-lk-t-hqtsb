#!/usr/bin/env bash
# replit-smoke.sh
# Run a quick health check after syncing from GitHub.
# Does NOT modify any files. Read-only checks only.

set -euo pipefail

SERVER_PORT="${PORT:-3001}"
SERVER_BASE="http://localhost:${SERVER_PORT}"

echo ""
echo "=== Replit Smoke Check ==="
echo ""

# 1. TypeScript check
echo "[1] TypeScript check..."
if npx tsc --noEmit 2>&1; then
  echo "    ✓ TypeScript: no errors"
else
  echo "    ✗ TypeScript: errors found (see above)"
  exit 1
fi
echo ""

# 2. /api/health — only if server is reachable
echo "[2] Server health check (optional)..."
if curl -sf --max-time 3 "${SERVER_BASE}/api/health" > /tmp/synco_health.json 2>/dev/null; then
  echo "    ✓ /api/health: $(cat /tmp/synco_health.json)"
else
  echo "    ~ /api/health: server not running or not reachable — skipping"
fi
echo ""

# 3. /api/now — only if server is reachable
echo "[3] Now action selector check (optional)..."
if curl -sf --max-time 3 "${SERVER_BASE}/api/now?userId=default-user" > /tmp/synco_now.json 2>/dev/null; then
  echo "    ✓ /api/now: $(cat /tmp/synco_now.json | head -c 200)"
else
  echo "    ~ /api/now: server not running or not reachable — skipping"
fi
echo ""

echo "=== Smoke check complete ==="
echo ""
