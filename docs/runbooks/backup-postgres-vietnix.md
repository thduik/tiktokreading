# Backup PostgreSQL to Vietnix S3

## Scope

Create PostgreSQL dump and upload to S3-compatible Vietnix bucket.

## Script

`scripts/backup-readtok-db-to-vietnix.sh`

## Required VPS Files

- `/opt/readtok/.env.production`:
  must include `DATABASE_URL`
- `/opt/readtok/.env.backup`:
  must include:
  - `S3_ENDPOINT=https://s3.vn-hcm-1.vietnix.cloud`
  - `S3_ACCESS_KEY=...`
  - `S3_SECRET_KEY=...`
  - `S3_BUCKET=...`

Optional keys:

- `S3_PREFIX` (default `prod/readtok/postgres`)
- `BACKUP_DIR` (default `/opt/readtok/backups`)

## Manual Run

On VPS:

```bash
cd /opt/readtok
bash ./scripts/backup-readtok-db-to-vietnix.sh
```

Expected output includes:

- `UPLOAD_OK`
- `bucket=...`
- `key=...`
- `size=...`

## Cron Example

Daily at 19:30 UTC:

```cron
30 19 * * * /opt/readtok/scripts/backup-readtok-db-to-vietnix.sh >> /opt/readtok/logs/backup-db.log 2>&1
```

## Verification

- Confirm recent dump exists in `BACKUP_DIR`.
- Confirm object key exists in bucket path.
- Periodically run a restore drill in non-production.
