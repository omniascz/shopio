#!/bin/sh
# Shopio Postgres backup loop (B5). Runs in a postgres:17-alpine sidecar so
# pg_dump matches the server major version. Daily gzipped dumps to /backups
# with retention; optionally mirrored to S3/MinIO if BACKUP_S3_BUCKET is set.
#
#   restore:  gunzip -c shopio-YYYYMMDD-HHMMSS.sql.gz | psql -h postgres -U $POSTGRES_USER $POSTGRES_DB
set -eu

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"
export PGPASSWORD="${POSTGRES_PASSWORD}"

echo "[backup] started — retention ${RETENTION_DAYS}d, interval ${INTERVAL}s"

while true; do
  ts="$(date +%Y%m%d-%H%M%S)"
  file="/backups/shopio-${ts}.sql.gz"
  echo "[backup] dumping ${ts}"
  if pg_dump -h postgres -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip > "${file}.tmp"; then
    mv "${file}.tmp" "${file}"
    echo "[backup] wrote ${file} ($(du -h "${file}" | cut -f1))"
    # Optional offsite copy to S3/MinIO (needs the aws CLI image variant + creds).
    if [ -n "${BACKUP_S3_BUCKET:-}" ] && command -v aws >/dev/null 2>&1; then
      aws --endpoint-url "${BACKUP_S3_ENDPOINT:-http://minio:9000}" s3 cp "${file}" "s3://${BACKUP_S3_BUCKET}/" || echo "[backup] S3 upload failed (non-fatal)"
    fi
  else
    echo "[backup] pg_dump FAILED" >&2
    rm -f "${file}.tmp"
  fi
  # Prune old local dumps.
  find /backups -name 'shopio-*.sql.gz' -mtime "+${RETENTION_DAYS}" -delete 2>/dev/null || true
  sleep "${INTERVAL}"
done
