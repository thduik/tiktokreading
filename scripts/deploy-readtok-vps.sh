#!/usr/bin/env bash
set -euo pipefail

# Deploy ReadTok frontend by building on VPS and publishing to Nginx web root.
# Expected remote layout:
#   repo:     /opt/readtok
#   web root: /var/www/readtok
#
# Usage:
#   scripts/deploy-readtok-vps.sh
#   VPS_HOST=debian@34.143.183.246 scripts/deploy-readtok-vps.sh

VPS_HOST="${VPS_HOST:-debian@34.143.183.246}"
REPO_DIR="${REPO_DIR:-/opt/readtok}"
WEBROOT_DIR="${WEBROOT_DIR:-/var/www/readtok}"
SSH_KEY_PATH="${SSH_KEY_PATH:-$HOME/.ssh/id_rsa}"

echo "[deploy] target host: ${VPS_HOST}"
echo "[deploy] repo dir:    ${REPO_DIR}"
echo "[deploy] webroot dir: ${WEBROOT_DIR}"
echo "[deploy] ssh key:     ${SSH_KEY_PATH}"

ssh -F /dev/null -o IdentityAgent=none -o IdentitiesOnly=yes -o PreferredAuthentications=publickey -i "${SSH_KEY_PATH}" "${VPS_HOST}" "bash -lc '
  set -euo pipefail
  cd \"${REPO_DIR}\"
  if [ -f .env.production ]; then
    set -a
    . ./.env.production
    set +a
  fi
  git pull --ff-only
  corepack enable
  corepack prepare pnpm@10.33.2 --activate
  node ./scripts/check-toolchain.mjs --pnpm
  corepack pnpm install --frozen-lockfile
  if [ -z \"\${VITE_CLERK_PUBLISHABLE_KEY:-}\" ] && [ -z \"\${CLERK_PUBLISHABLE_KEY:-}\" ]; then
    echo \"[deploy] missing Clerk publishable key; refusing to build frontend in local mode\"
    exit 1
  fi

  CLERK_PUBLISHABLE_KEY_RUNTIME=\"\${VITE_CLERK_PUBLISHABLE_KEY:-\${CLERK_PUBLISHABLE_KEY:-}}\"
  CLERK_PROXY_URL_RUNTIME=\"\${VITE_CLERK_PROXY_URL:-\${CLERK_PROXY_URL:-}}\"

  corepack pnpm --filter @workspace/readtok run typecheck
  corepack pnpm --filter @workspace/readtok run build

  cat > \"${REPO_DIR}/artifacts/readtok/dist/public/runtime-config.js\" <<EOF
window.__READTOK_CONFIG = Object.assign({}, window.__READTOK_CONFIG, {
  clerkPublishableKey: \"\${CLERK_PUBLISHABLE_KEY_RUNTIME}\",
  clerkProxyUrl: \"\${CLERK_PROXY_URL_RUNTIME}\"
});
EOF

  rsync -avc --delete \"${REPO_DIR}/artifacts/readtok/dist/public/\" \"${WEBROOT_DIR}/\"

  # Rewrite after rsync as a hard guard against the checked-in placeholder ever
  # being the final live file. If this file is empty, Profile would otherwise
  # silently fall back to local mode.
  cat > \"${WEBROOT_DIR}/runtime-config.js\" <<EOF
window.__READTOK_CONFIG = Object.assign({}, window.__READTOK_CONFIG, {
  clerkPublishableKey: \"\${CLERK_PUBLISHABLE_KEY_RUNTIME}\",
  clerkProxyUrl: \"\${CLERK_PROXY_URL_RUNTIME}\"
});
EOF

  if grep -q \"window.__READTOK_CONFIG = window.__READTOK_CONFIG || {}\" \"${WEBROOT_DIR}/runtime-config.js\"; then
    echo \"[deploy] runtime-config.js is still the placeholder; refusing deploy\"
    exit 1
  fi

  if ! grep -q \"clerkPublishableKey: \\\".\" \"${WEBROOT_DIR}/runtime-config.js\"; then
    echo \"[deploy] runtime-config.js does not contain a Clerk publishable key; refusing deploy\"
    exit 1
  fi

  echo \"[deploy] published bundle:\"
  head -n 20 \"${WEBROOT_DIR}/index.html\"
  echo \"[deploy] runtime config: verified Clerk key present\"
'"

echo "[deploy] live check:"
curl -fsSL "https://ieltstok.online" | sed -n '1,20p'

echo "[deploy] live runtime config check:"
curl -fsSL "https://ieltstok.online/runtime-config.js" \
  | grep -q "clerkPublishableKey: \"."
echo "[deploy] live runtime config: verified Clerk key present"

echo "[deploy] done"
