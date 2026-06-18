#!/usr/bin/env bash
# replit-sync.sh
# Pull the latest GitHub main branch and reset Replit to match it exactly.
# This is a READ-ONLY sync — no commits, no pushes, no file modifications.

set -euo pipefail

echo ""
echo "=== Replit Sync → GitHub origin/main ==="
echo ""

# 1. Fetch latest state from GitHub
echo "[1/4] Fetching origin..."
git fetch origin

# 2. Hard-reset to origin/main — discard any local Replit drift
echo "[2/4] Resetting to origin/main..."
git reset --hard origin/main

# 3. Clean untracked files that might interfere (but NOT .env files)
echo "[3/4] Cleaning untracked build artifacts..."
git clean -fd --exclude='.env' --exclude='.env.local' --exclude='node_modules' --exclude='.replit' --exclude='replit.nix'

# 4. Report current state
echo ""
echo "[4/4] Current state:"
echo "  HEAD: $(git rev-parse HEAD)"
echo "  Branch: $(git rev-parse --abbrev-ref HEAD)"
echo ""
git log --oneline -5
echo ""
git status
echo ""
echo "=== Sync complete. Replit matches GitHub. ==="
echo ""
