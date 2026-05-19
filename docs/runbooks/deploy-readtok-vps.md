# Deploy ReadTok to VPS

## Scope

Frontend build and publish to Nginx webroot on VPS.

## Preconditions

- SSH access to VPS.
- Current production host:
  `root@103.69.97.207`
- VPS repo path:
  `/opt/readtok`
- Webroot path:
  `/var/www/readtok`
- Node follows the repo contract:
  `20.19.5` from `.nvmrc` / `.node-version`
- Clerk publishable key available in VPS env:
  `VITE_CLERK_PUBLISHABLE_KEY` or `CLERK_PUBLISHABLE_KEY`

## Standard Command

From repo root:

```bash
pnpm run deploy:readtok:vps
```

This calls:

`scripts/deploy-readtok-vps.sh`

Do not publish `artifacts/readtok/dist/public/` manually with a raw `rsync`.
Use the script below so:
- repo files are synced from the local workspace to the VPS
- `/var/www/readtok/runtime-config.js` is rewritten from VPS env
- the API service is restarted in the same guarded path
- Nginx cache headers are refreshed from the repo-managed config

The checked-in `public/runtime-config.js` is only a placeholder.

Hosted app guard: if Clerk runtime config is missing on a non-local hostname,
the frontend now shows a production config error instead of falling back to
local Profile mode. This protects cross-device profile data from silently
splitting again.

## What the Script Does

1. Sync the local repo to `/opt/readtok` on the VPS with guarded excludes.
2. Load `.env.production` on the VPS.
3. Refuse deploy if Clerk public or secret keys are missing.
4. Enable Corepack and activate `pnpm@10.33.2`.
5. Run the repo toolchain check.
6. `corepack pnpm install --frozen-lockfile` in non-interactive mode.
7. Build `@workspace/api-server`.
8. Refresh the passage search catalog and cleanly close Redis handles.
9. Typecheck and build `@workspace/readtok`.
10. Write `runtime-config.js` with Clerk runtime keys.
11. Publish built frontend to `/var/www/readtok`.
12. Install the repo-managed Nginx site config with cache rules.
13. Reload Nginx and restart the API service.
14. Verify API health, `index.html`, `runtime-config.js`, and that the live bundle path matches the published bundle path exactly.

If deploy stops at the toolchain check, update Node on the VPS before trying
again. This prevents the app from building with the wrong Vite/Rollup native
package set.

## Cache Policy

The repo-managed Nginx config now ships explicit cache headers:

- `index.html` -> `Cache-Control: no-cache, no-store, must-revalidate`
- `runtime-config.js` -> `Cache-Control: no-cache, no-store, must-revalidate`
- `/assets/*` hashed bundles -> `Cache-Control: public, max-age=31536000, immutable`

Canonical config lives at:

`ops/nginx/readtok.conf`

## Database Migrations

When a change adds files under `lib/db/migrations`, run migrations on the VPS
before restarting API behavior that depends on the new table:

```bash
cd /opt/readtok
set -a
. ./.env.production
set +a
corepack pnpm --filter @workspace/db run migrate
```

Current answer analytics uses `user_daily_answer_stats`, updated on every
signed-in answer submission.

## Fast Verification

```bash
curl -fsSL https://ieltstok.online | sed -n '1,20p'
```

Confirm script and stylesheet bundle hashes changed as expected.
Also confirm:

```bash
curl -fsSL https://ieltstok.online/runtime-config.js | grep 'clerkPublishableKey: ".'
```

And verify the live API still serves:

```bash
curl -fsSL 'https://ieltstok.online/api/passages?limit=1' >/dev/null
```

## Done Means Live

Do not say a change is live until all of these are true:

1. Deploy targeted the current production host (`root@103.69.97.207` unless intentionally overridden).
2. The script completed without hanging or partial exit.
3. The live `index.html` points to the same hashed bundle that exists in `/var/www/readtok`.
4. `runtime-config.js` contains the Clerk publishable key on the live origin.
5. The live API responds after restart.
6. If the task touched data, verify the production DB or API payload, not just local code.

If any one of those is missing, the work is not done yet.
