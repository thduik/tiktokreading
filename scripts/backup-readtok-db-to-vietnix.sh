#!/usr/bin/env bash
set -euo pipefail

# Daily PostgreSQL backup to Vietnix S3-compatible object storage.
# Expected files on VPS:
# - /opt/readtok/.env.production (must include DATABASE_URL)
# - /opt/readtok/.env.backup (must include S3 settings below)
#
# Required .env.backup keys:
#   S3_ENDPOINT=https://s3.vn-hcm-1.vietnix.cloud
#   S3_ACCESS_KEY=...
#   S3_SECRET_KEY=...
#   S3_BUCKET=dbbackups1
# Optional:
#   S3_PREFIX=prod/readtok/postgres
#   BACKUP_DIR=/opt/readtok/backups

REPO_DIR="${REPO_DIR:-/opt/readtok}"
ENV_FILE="${ENV_FILE:-$REPO_DIR/.env.production}"
BACKUP_ENV_FILE="${BACKUP_ENV_FILE:-$REPO_DIR/.env.backup}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: missing env file: $ENV_FILE" >&2
  exit 1
fi

if [ ! -f "$BACKUP_ENV_FILE" ]; then
  echo "ERROR: missing backup env file: $BACKUP_ENV_FILE" >&2
  exit 1
fi

set -a
. "$ENV_FILE"
. "$BACKUP_ENV_FILE"
set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is missing" >&2
  exit 1
fi

if [ -z "${S3_ENDPOINT:-}" ] || [ -z "${S3_ACCESS_KEY:-}" ] || [ -z "${S3_SECRET_KEY:-}" ] || [ -z "${S3_BUCKET:-}" ]; then
  echo "ERROR: one or more required S3 vars are missing (S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET)" >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-$REPO_DIR/backups}"
S3_PREFIX="${S3_PREFIX:-prod/readtok/postgres}"

mkdir -p "$BACKUP_DIR"

TS_UTC="$(date -u +%Y%m%dT%H%M%SZ)"
YEAR="$(date -u +%Y)"
MONTH="$(date -u +%m)"
FILE_NAME="readtok_${TS_UTC}.dump"
FILE_PATH="$BACKUP_DIR/$FILE_NAME"
S3_KEY="${S3_PREFIX}/${YEAR}/${MONTH}/${FILE_NAME}"

pg_dump "$DATABASE_URL" -Fc -f "$FILE_PATH"

python3 - <<PY
import boto3
from botocore.config import Config
from pathlib import Path

endpoint = "${S3_ENDPOINT}"
access_key = "${S3_ACCESS_KEY}"
secret_key = "${S3_SECRET_KEY}"
bucket = "${S3_BUCKET}"
file_path = Path("${FILE_PATH}")
key = "${S3_KEY}"

client = boto3.client(
    "s3",
    endpoint_url=endpoint,
    aws_access_key_id=access_key,
    aws_secret_access_key=secret_key,
    region_name="vn-hcm-1",
    config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
)

with file_path.open("rb") as f:
    client.put_object(
        Bucket=bucket,
        Key=key,
        Body=f,
        ContentLength=file_path.stat().st_size,
    )

head = client.head_object(Bucket=bucket, Key=key)
print("UPLOAD_OK")
print(f"bucket={bucket}")
print(f"key={key}")
print(f"size={head.get('ContentLength')}")
PY

ls -lh "$FILE_PATH"
