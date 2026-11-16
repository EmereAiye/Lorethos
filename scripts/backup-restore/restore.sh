#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE="${1:-}"
if [[ -z "${BACKUP_FILE}" || ! -f "${BACKUP_FILE}" ]]; then
  echo "Usage: $0 <path-to-backup.sql.gz>" >&2
  exit 1
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  gunzip -c "${BACKUP_FILE}" | psql "${DATABASE_URL}"
else
  gunzip -c "${BACKUP_FILE}" | docker compose exec -T postgres psql -U "${POSTGRES_USER:-lorethos}" "${POSTGRES_DB:-lorethos}"
fi

echo "Database restored cleanly from ${BACKUP_FILE}"
