#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${1:-./backups}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET_FILE="${BACKUP_DIR}/lorethos_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

if [[ -n "${DATABASE_URL:-}" ]]; then
  pg_dump "${DATABASE_URL}" | gzip > "${TARGET_FILE}"
else
  docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-lorethos}" "${POSTGRES_DB:-lorethos}" | gzip > "${TARGET_FILE}"
fi

echo "Backup written to ${TARGET_FILE}"
