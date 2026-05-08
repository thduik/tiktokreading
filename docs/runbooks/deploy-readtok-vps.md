# Deploy ReadTok to VPS

## Scope

Frontend build and publish to Nginx webroot on VPS.

## Preconditions

- SSH access to VPS.
- VPS repo path:
  `/opt/readtok`
- Webroot path:
  `/var/www/readtok`
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
3. `corepack pnpm install`.
4. Build `@workspace/readtok`.
5. Write `runtime-config.js` with Clerk runtime keys.
6. `rsync` built assets into `/var/www/readtok`.
7. Print first lines of live `index.html`.
8. Curl live URL for quick check.

## Fast Verification

```bash
curl -fsSL https://ieltstok.online | sed -n '1,20p'
```

Confirm script and stylesheet bundle hashes changed as expected.
