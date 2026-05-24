#!/usr/bin/env bash
set -euo pipefail

# Deploy ReadTok app bundle and API to the VPS using the current rsync-based
# workflow. This keeps runtime-config.js and Nginx cache behavior in the same
# guarded path instead of relying on ad hoc manual publish steps.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_REPO_DIR="${LOCAL_REPO_DIR:-$(cd "${SCRIPT_DIR}/.." && pwd)}"

VPS_HOST="${VPS_HOST:-root@103.69.97.207}"
REMOTE_REPO_DIR="${REMOTE_REPO_DIR:-/opt/readtok}"
REMOTE_WEBROOT_DIR="${REMOTE_WEBROOT_DIR:-/var/www/readtok}"
REMOTE_API_SERVICE="${REMOTE_API_SERVICE:-readtok-api.service}"
SSH_KEY_PATH="${SSH_KEY_PATH:-$HOME/.ssh/id_rsa}"
SSH_PASSWORD="${SSH_PASSWORD:-}"
SUDO_PASSWORD="${SUDO_PASSWORD:-${SSH_PASSWORD}}"
PRODUCTION_ORIGIN="${PRODUCTION_ORIGIN:-https://ieltstok.online}"

echo "[deploy] source dir:  ${LOCAL_REPO_DIR}"
echo "[deploy] target host: ${VPS_HOST}"
echo "[deploy] repo dir:    ${REMOTE_REPO_DIR}"
echo "[deploy] webroot dir: ${REMOTE_WEBROOT_DIR}"
echo "[deploy] api service: ${REMOTE_API_SERVICE}"

SSH_COMMON_ARGS=(
  -F /dev/null
  -o StrictHostKeyChecking=no
  -o PreferredAuthentications=publickey,password
)

if [[ -n "${SSH_PASSWORD}" ]]; then
  if ! command -v sshpass >/dev/null 2>&1; then
    echo "[deploy] SSH_PASSWORD is set but sshpass is not installed"
    exit 1
  fi
  export SSHPASS="${SSH_PASSWORD}"
  SSH_CMD=(sshpass -e ssh "${SSH_COMMON_ARGS[@]}")
  RSYNC_RSH="sshpass -e ssh ${SSH_COMMON_ARGS[*]}"
  echo "[deploy] auth mode: password"
else
  SSH_CMD=(ssh "${SSH_COMMON_ARGS[@]}" -o IdentitiesOnly=yes -i "${SSH_KEY_PATH}")
  RSYNC_RSH="ssh ${SSH_COMMON_ARGS[*]} -o IdentitiesOnly=yes -i ${SSH_KEY_PATH}"
  echo "[deploy] auth mode: key"
  echo "[deploy] ssh key:   ${SSH_KEY_PATH}"
fi

if [[ ! -d "${LOCAL_REPO_DIR}" ]]; then
  echo "[deploy] source repo directory not found"
  exit 1
fi

"${SSH_CMD[@]}" "${VPS_HOST}" "mkdir -p '${REMOTE_REPO_DIR}' '${REMOTE_WEBROOT_DIR}'"

rsync -az --partial --delete \
  --exclude '.git' \
  --exclude '.env*' \
  --exclude 'node_modules' \
  --exclude 'artifacts/readtok/node_modules' \
  --exclude 'artifacts/api-server/node_modules' \
  --exclude 'lib/db/node_modules' \
  -e "${RSYNC_RSH}" \
  "${LOCAL_REPO_DIR}/" "${VPS_HOST}:${REMOTE_REPO_DIR}/"

"${SSH_CMD[@]}" "${VPS_HOST}" \
  "REMOTE_REPO_DIR='${REMOTE_REPO_DIR}' REMOTE_WEBROOT_DIR='${REMOTE_WEBROOT_DIR}' REMOTE_API_SERVICE='${REMOTE_API_SERVICE}' SUDO_PASSWORD='${SUDO_PASSWORD}' bash -s" <<'REMOTE'
set -euo pipefail

cd "${REMOTE_REPO_DIR}"

run_sudo() {
  if sudo -n true 2>/dev/null; then
    sudo "$@"
    return
  fi

  if [ -z "${SUDO_PASSWORD:-}" ]; then
    echo "[deploy] sudo password required but not provided"
    exit 1
  fi

  printf '%s\n' "${SUDO_PASSWORD}" | sudo -S "$@"
}

if [ -f .env.production ]; then
  set -a
  . ./.env.production
  set +a
fi

if [ -z "${VITE_CLERK_PUBLISHABLE_KEY:-}" ] && [ -z "${CLERK_PUBLISHABLE_KEY:-}" ]; then
  echo "[deploy] missing Clerk publishable key; refusing to publish hosted app"
  exit 1
fi

if [ -z "${CLERK_SECRET_KEY:-}" ]; then
  echo "[deploy] missing Clerk secret key; refusing to restart hosted auth stack"
  exit 1
fi

CLERK_PUBLISHABLE_KEY_RUNTIME="${VITE_CLERK_PUBLISHABLE_KEY:-${CLERK_PUBLISHABLE_KEY:-}}"
CLERK_PROXY_URL_RUNTIME="${VITE_CLERK_PROXY_URL:-${CLERK_PROXY_URL:-}}"

node ./scripts/check-toolchain.mjs --pnpm
CI=true corepack pnpm install --frozen-lockfile --config.confirmModulesPurge=false --config.engine-strict=false
corepack pnpm --filter @workspace/db run migrate
corepack pnpm --filter @workspace/api-server run build
corepack pnpm --filter @workspace/api-server exec tsx ./src/scripts/refresh-passage-search-catalog.ts
corepack pnpm --filter @workspace/readtok run typecheck
corepack pnpm --filter @workspace/readtok run build

cat > "${REMOTE_REPO_DIR}/artifacts/readtok/dist/public/runtime-config.js" <<EOF
window.__READTOK_CONFIG = Object.assign({}, window.__READTOK_CONFIG, {
  clerkPublishableKey: "${CLERK_PUBLISHABLE_KEY_RUNTIME}",
  clerkProxyUrl: "${CLERK_PROXY_URL_RUNTIME}"
});
EOF

rsync -avc --delete "${REMOTE_REPO_DIR}/artifacts/readtok/dist/public/" "${REMOTE_WEBROOT_DIR}/"

cat > "${REMOTE_WEBROOT_DIR}/runtime-config.js" <<EOF
window.__READTOK_CONFIG = Object.assign({}, window.__READTOK_CONFIG, {
  clerkPublishableKey: "${CLERK_PUBLISHABLE_KEY_RUNTIME}",
  clerkProxyUrl: "${CLERK_PROXY_URL_RUNTIME}"
});
EOF

if [ -f "${REMOTE_REPO_DIR}/ops/nginx/readtok.conf" ]; then
  run_sudo cp "${REMOTE_REPO_DIR}/ops/nginx/readtok.conf" /etc/nginx/sites-available/readtok
  run_sudo ln -sf /etc/nginx/sites-available/readtok /etc/nginx/sites-enabled/readtok
  run_sudo nginx -t
  run_sudo systemctl reload nginx
fi

run_sudo systemctl restart "${REMOTE_API_SERVICE}"

if grep -q "window.__READTOK_CONFIG = window.__READTOK_CONFIG || {}" "${REMOTE_WEBROOT_DIR}/runtime-config.js"; then
  echo "[deploy] runtime-config.js is still the placeholder; refusing deploy"
  exit 1
fi

if ! grep -q 'clerkPublishableKey: ".' "${REMOTE_WEBROOT_DIR}/runtime-config.js"; then
  echo "[deploy] runtime-config.js does not contain a Clerk publishable key; refusing deploy"
  exit 1
fi

systemctl is-active "${REMOTE_API_SERVICE}"

api_ready=0
for attempt in 1 2 3 4 5; do
  if curl -fsSL http://127.0.0.1:3000/api/passages?limit=1 >/dev/null 2>&1; then
    api_ready=1
    break
  fi
  sleep 1
done

if [ "${api_ready}" -ne 1 ]; then
  echo "[deploy] API health check failed after restart"
  exit 1
fi

echo "[deploy] published bundle:"
head -n 20 "${REMOTE_WEBROOT_DIR}/index.html"
echo "[deploy] runtime config: verified Clerk key present"
REMOTE

REMOTE_BUNDLE_PATH="$("${SSH_CMD[@]}" "${VPS_HOST}" "python3 - <<'PY'
from pathlib import Path
import re

html = Path('${REMOTE_WEBROOT_DIR}/index.html').read_text(encoding='utf-8')
match = re.search(r'<script\\s+type=\"module\"\\s+crossorigin\\s+src=\"([^\"]*assets/index-[^\"]+\\.js)\"', html)
print(match.group(1) if match else '')
PY")"

echo "[deploy] live check:"
LIVE_INDEX_HTML="$(curl -fsSL "${PRODUCTION_ORIGIN}")"
printf '%s\n' "${LIVE_INDEX_HTML}" | sed -n '1,20p'

LIVE_BUNDLE_PATH="$(LIVE_INDEX_HTML="${LIVE_INDEX_HTML}" python3 - <<'PY'
import re
import os

html = os.environ.get("LIVE_INDEX_HTML", "")
match = re.search(r'<script\s+type="module"\s+crossorigin\s+src="([^"]*assets/index-[^"]+\.js)"', html)
print(match.group(1) if match else '')
PY
)"

if [[ -z "${REMOTE_BUNDLE_PATH}" || -z "${LIVE_BUNDLE_PATH}" ]]; then
  echo "[deploy] failed to resolve published bundle path"
  exit 1
fi

if [[ "${REMOTE_BUNDLE_PATH}" != "${LIVE_BUNDLE_PATH}" ]]; then
  echo "[deploy] live bundle mismatch"
  echo "[deploy] remote bundle: ${REMOTE_BUNDLE_PATH}"
  echo "[deploy] live bundle:   ${LIVE_BUNDLE_PATH}"
  exit 1
fi

curl -fsSL "${PRODUCTION_ORIGIN}${LIVE_BUNDLE_PATH}" >/dev/null

echo "[deploy] live runtime config check:"
curl -fsSL "${PRODUCTION_ORIGIN}/runtime-config.js" | grep -q 'clerkPublishableKey: ".'
echo "[deploy] live runtime config: verified Clerk key present"

echo "[deploy] live API check:"
curl -fsSL "${PRODUCTION_ORIGIN}/api/passages?limit=1" >/dev/null
echo "[deploy] live API: verified"

echo "[deploy] live bundle: ${LIVE_BUNDLE_PATH}"

echo "[deploy] done"
