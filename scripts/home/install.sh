#!/usr/bin/env bash
# One-time setup of the home server services (run inside WSL, as yourself, from the repo).
#
#   bash scripts/home/install.sh                 # app service only
#   bash scripts/home/install.sh --auto-update   # + deploy origin/main every 10 minutes
#
# Writes systemd *user* units to ~/.config/systemd/user/ and enables them. Re-run it after
# moving the repo or changing Node/pnpm/Claude Code installs (it records their paths).
# Env override: PORT (default 3000).
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${PORT:-3000}"
UNITS="$HOME/.config/systemd/user"
AUTO_UPDATE=0
for arg in "$@"; do
  case "$arg" in
    --auto-update) AUTO_UPDATE=1 ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 2
      ;;
  esac
done

die() {
  printf '[install] ERROR: %s\n' "$*" >&2
  exit 1
}

systemctl --user show-environment >/dev/null 2>&1 ||
  die "systemd is not running in WSL. Add '[boot] systemd=true' to /etc/wsl.conf, run 'wsl --shutdown' in PowerShell, reopen Ubuntu, then retry."

NODE_BIN="$(command -v node)" || die "node not found on PATH."
PNPM_BIN="$(command -v pnpm)" || die "pnpm not found on PATH."
CLAUDE_BIN="$(command -v claude)" || die "claude (Claude Code) not found on PATH. Install it and log in first."

# PATH for the service: node, pnpm and claude must all be found without a login shell.
SERVICE_PATH="$(dirname "$NODE_BIN"):$(dirname "$PNPM_BIN"):$(dirname "$CLAUDE_BIN"):/usr/local/bin:/usr/bin:/bin"

mkdir -p "$UNITS"
render() {
  sed -e "s|@REPO@|$REPO|g" -e "s|@PATH@|$SERVICE_PATH|g" -e "s|@PNPM@|$PNPM_BIN|g" \
    -e "s|@PORT@|$PORT|g" "$REPO/scripts/home/systemd/$1" >"$UNITS/$1"
  echo "[install] wrote $UNITS/$1"
}
render mylanguagelearner.service
render mylanguagelearner-update.service
render mylanguagelearner-update.timer

systemctl --user daemon-reload
systemctl --user enable mylanguagelearner.service
if [ "$AUTO_UPDATE" = 1 ]; then
  systemctl --user enable --now mylanguagelearner-update.timer
  echo "[install] auto-update on: origin/main is deployed within 10 minutes of a push."
else
  systemctl --user disable --now mylanguagelearner-update.timer 2>/dev/null || true
fi

# Keep user services running without an open terminal.
if [ "$(loginctl show-user "$USER" --property=Linger --value 2>/dev/null)" != "yes" ]; then
  echo "[install] enabling linger (asks for your sudo password)"
  sudo loginctl enable-linger "$USER" || echo "[install] WARNING: run 'sudo loginctl enable-linger $USER' yourself."
fi

echo "[install] done. Next: pnpm home:deploy"
