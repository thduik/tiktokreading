# Deploy ReadTok to VPS

## Scope

Frontend build and publish to Nginx webroot on VPS.

## Preconditions

- SSH access to VPS.
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

## What the Script Does

1. SSH into VPS.
2. `git pull --ff-only`.
3. Enable Corepack and activate `pnpm@10.33.2`.
4. Run the repo toolchain check.
5. `corepack pnpm install --frozen-lockfile`.
6. Typecheck and build `@workspace/readtok`.
7. Write `runtime-config.js` with Clerk runtime keys.
8. `rsync` built assets into `/var/www/readtok`.
9. Print first lines of live `index.html`.
10. Curl live URL for quick check.

If deploy stops at the toolchain check, update Node on the VPS before trying
again. This prevents the app from building with the wrong Vite/Rollup native
package set.

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
