#!/usr/bin/env bash
# Deploy myLanguageLearner on the home server (WSL): pull, install, migrate, build, restart.
#
#   pnpm home:deploy                  # deploy the latest origin/main
#   bash scripts/home/deploy.sh --if-changed   # only if origin/main moved (auto-update timer)
#   bash scripts/home/deploy.sh --no-pull      # rebuild what is checked out (local changes)
#
# Env overrides: DEPLOY_BRANCH (default main), PORT (default 3000).
# Secrets live in .env.production.local (never committed); see docs/HOME_HOSTING.md.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BRANCH="${DEPLOY_BRANCH:-main}"
PORT="${PORT:-3000}"
SERVICE="mylanguagelearner"
ENV_FILE=".env.production.local"
IF_CHANGED=0
PULL=1

for arg in "$@"; do
  case "$arg" in
    --if-changed) IF_CHANGED=1 ;;
    --no-pull) PULL=0 ;;
    -h | --help)
      sed -n '2,9p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 2
      ;;
  esac
done

log() { printf '[deploy %s] %s\n' "$(date '+%H:%M:%S')" "$*"; }
die() {
  printf '[deploy] ERROR: %s\n' "$*" >&2
  exit 1
}

cd "$REPO"
[ -f "$ENV_FILE" ] || die "$ENV_FILE is missing in $REPO (copy .env.example and fill it, see docs/HOME_HOSTING.md)."

# Only one deploy at a time (the timer and a manual run could overlap).
exec 9>"$REPO/.deploy.lock"
flock -n 9 || die "another deploy is running."

if [ "$PULL" = 1 ]; then
  log "Fetching origin/$BRANCH"
  git fetch --quiet origin "$BRANCH"
  if [ "$IF_CHANGED" = 1 ] && [ "$(git rev-parse HEAD)" = "$(git rev-parse FETCH_HEAD)" ]; then
    log "Already at $(git rev-parse --short HEAD), nothing to do."
    exit 0
  fi
  if ! git diff --quiet || ! git diff --cached --quiet; then
    die "the checkout has uncommitted changes; commit/stash them or use --no-pull."
  fi
  git checkout --quiet "$BRANCH"
  git merge --quiet --ff-only FETCH_HEAD ||
    die "local $BRANCH has diverged from origin/$BRANCH; fix it by hand."
fi

COMMIT="$(git rev-parse --short HEAD)"
log "Deploying $COMMIT"

log "Installing dependencies"
pnpm install --frozen-lockfile --prefer-offline

log "Applying database migrations"
pnpm db:migrate:prod

log "Building"
APP_COMMIT="$COMMIT" pnpm build

log "Restarting $SERVICE"
systemctl --user restart "$SERVICE"

log "Waiting for http://127.0.0.1:$PORT/api/health"
for _ in $(seq 1 30); do
  if body="$(curl -fsS --max-time 5 "http://127.0.0.1:$PORT/api/health" 2>/dev/null)"; then
    log "Healthy: $body"
    exit 0
  fi
  sleep 2
done

echo "[deploy] ERROR: the app did not become healthy. Last log lines:" >&2
journalctl --user -u "$SERVICE" -n 50 --no-pager >&2 || true
exit 1
