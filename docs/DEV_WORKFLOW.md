# Synco Dev Workflow

## Source of Truth

**GitHub `main` branch is the single source of truth.**

All code changes originate from Claude Code (local machine) and are pushed to GitHub.
Replit is a preview environment only — it reads from GitHub, it does not write to it.

---

## Who Does What

| Role | Tool | Allowed Actions |
|------|------|----------------|
| Code author | Claude Code (local) | Write, commit, push to GitHub |
| Preview / QA | Replit | Pull from GitHub, run the app, verify behavior |
| Replit Agent | Replit | **Off-limits for code changes** (see below) |

---

## Normal Build Cycle

```
Claude Code (local)
  → writes / modifies code
  → runs TypeScript check
  → runs tests
  → git commit
  → git push origin main

Replit
  → git pull  (or run scripts/replit-sync.sh)
  → npm install  (if package.json changed)
  → start the app
  → verify in browser
```

---

## Syncing Replit to GitHub

After Claude Code pushes a new commit, sync Replit with:

```bash
bash scripts/replit-sync.sh
```

This script:
1. Fetches latest `origin/main`
2. Hard-resets the Replit working tree to match GitHub exactly
3. Cleans untracked build artifacts (never touches `.env` or `.env.local`)
4. Prints the current HEAD and git status

**Do not commit or push from Replit after running this script.**

---

## Smoke Check After Sync

Once the app is running on Replit, verify it is healthy:

```bash
bash scripts/replit-smoke.sh
```

This script:
1. Runs TypeScript (`npx tsc --noEmit`) — exits with error if types are broken
2. Calls `/api/health` if the server is reachable
3. Calls `/api/now?userId=default-user` if the server is reachable

All checks are read-only. No files are modified.

---

## Replit Agent — Do Not Use for Code

**Never use Replit Agent to write or modify application code unless explicitly requested by the team.**

Replit Agent commits directly to `main` without going through Claude Code review.
This causes:
- Unreviewed code reaching production
- Conflicts when Claude Code pushes next
- Loss of test coverage and TypeScript safety

If Replit Agent has already made commits and Replit has drifted from GitHub:

```bash
bash scripts/replit-sync.sh
```

This discards all local Replit changes and realigns with GitHub.

---

## If Replit Diverges from GitHub

Signs of divergence:
- `git status` shows modified or untracked files
- `git log` shows commits not on GitHub
- The app behaves differently from what Claude Code shipped

Fix:

```bash
bash scripts/replit-sync.sh
```

This is safe — it only resets Replit to match GitHub. It never pushes anything.

---

## Environment Variables

- `.env` and `.env.local` are **never committed to Git**
- They live only in Replit's Secrets or on the local machine
- `replit-sync.sh` explicitly excludes them from `git clean`

---

## File Conventions

| Path | Purpose |
|------|---------|
| `scripts/replit-sync.sh` | Replit → GitHub hard sync |
| `scripts/replit-smoke.sh` | Post-sync health check |
| `docs/DEV_WORKFLOW.md` | This file |
| `docs/architecture-inventory.md` | Full system architecture reference |
