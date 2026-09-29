#!/usr/bin/env bash
#
# backup-production.sh — Postgres backup for the Aadhya app.
#
# Usage:
#   PGPASSWORD=*** ./scripts/backup-production.sh
#
# Required env vars:
#   PGHOST, PGPORT, PGUSER, PGDATABASE, PGPASSWORD
#   (standard libpq vars — never pass the password on the command line or in
#   a connection-string argument, and never echo/log it)
#
# Optional env vars:
#   BACKUP_DIR                 Directory to write dumps into (default: ./backups)
#   BACKUP_RETENTION_DAILY     Days of daily backups to keep   (default: 7)
#   BACKUP_RETENTION_WEEKLY    Weeks of weekly backups to keep (default: 4)
#   BACKUP_METADATA_FILE       Path to a small JSON file this script updates
#                              after every run, so the admin System Health
#                              page can read "latest backup" without needing
#                              filesystem access itself (default:
#                              "$BACKUP_DIR/backup-metadata.json")
#   BACKUP_LOG_FILE            Marker/log file the health endpoint tails for
#                              recent failures (default: "$BACKUP_DIR/backup.log")
#
# Exit codes: 0 success, non-zero on any failure. Never deletes existing
# backups if the dump/verify step for THIS run failed.
#
# ---------------------------------------------------------------------------
# Cron example (run once daily at 2:15am local time, low-traffic window):
#   15 2 * * *  BACKUP_DIR=/var/backups/aadhya PGPASSWORD_FILE=/etc/aadhya/db.pass \
#     bash -c 'PGPASSWORD=$(cat "$PGPASSWORD_FILE") /opt/aadhya/scripts/backup-production.sh' \
#     >> /var/log/aadhya-backup-cron.log 2>&1
#   (Keep the real password only in the root-readable PGPASSWORD_FILE, never
#   in the crontab itself, which other local users may be able to read.)
#
# systemd timer example:
#   /etc/systemd/system/aadhya-backup.service
#     [Unit]
#     Description=Aadhya production database backup
#     [Service]
#     Type=oneshot
#     EnvironmentFile=/etc/aadhya/backup.env   # contains PGPASSWORD=... (chmod 600)
#     ExecStart=/opt/aadhya/scripts/backup-production.sh
#
#   /etc/systemd/system/aadhya-backup.timer
#     [Unit]
#     Description=Run Aadhya database backup daily at low traffic
#     [Timer]
#     OnCalendar=*-*-* 02:15:00
#     Persistent=true
#     [Install]
#     WantedBy=timers.target
#
#   Enable with: systemctl enable --now aadhya-backup.timer
# ---------------------------------------------------------------------------

set -o errexit
set -o nounset
set -o pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAILY_DAYS="${BACKUP_RETENTION_DAILY:-7}"
RETENTION_WEEKLY_WEEKS="${BACKUP_RETENTION_WEEKLY:-4}"
METADATA_FILE="${BACKUP_METADATA_FILE:-$BACKUP_DIR/backup-metadata.json}"
LOG_FILE="${BACKUP_LOG_FILE:-$BACKUP_DIR/backup.log}"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DAY_OF_WEEK="$(date -u +%u)" # 1=Monday .. 7=Sunday
BACKUP_FILENAME="aadhya-${TIMESTAMP}.dump"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"

log() {
  # Never interpolate PGPASSWORD or any secret into this function's args.
  local msg="[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"
  echo "$msg"
  mkdir -p "$(dirname "$LOG_FILE")"
  echo "$msg" >> "$LOG_FILE"
}

write_metadata() {
  # status: "ok" | "failed"
  local status="$1"
  local sizeBytes="${2:-0}"
  mkdir -p "$(dirname "$METADATA_FILE")"
  cat > "$METADATA_FILE" <<JSON
{
  "lastRunAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "${status}",
  "file": "${BACKUP_FILENAME}",
  "sizeBytes": ${sizeBytes}
}
JSON
  chmod 600 "$METADATA_FILE" || true
}

fail() {
  log "BACKUP FAILED: $*"
  write_metadata "failed" 0
  exit 1
}

# --- Preconditions -----------------------------------------------------
command -v pg_dump >/dev/null 2>&1 || fail "pg_dump not found on PATH"
command -v pg_restore >/dev/null 2>&1 || fail "pg_restore not found on PATH"

: "${PGHOST:?PGHOST must be set}"
: "${PGPORT:?PGPORT must be set}"
: "${PGUSER:?PGUSER must be set}"
: "${PGDATABASE:?PGDATABASE must be set}"
: "${PGPASSWORD:?PGPASSWORD must be set (never pass the password as a CLI arg)}"

mkdir -p "$BACKUP_DIR"
# Restrictive permissions: only the owner can read/write/list backups.
chmod 700 "$BACKUP_DIR" || true

log "Starting backup of database '${PGDATABASE}' -> ${BACKUP_PATH}"

# PGPASSWORD is read from the environment by libpq directly; it is never
# passed as a command-line argument and never echoed/logged here.
if ! pg_dump -Fc -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f "$BACKUP_PATH"; then
  fail "pg_dump exited non-zero"
fi

chmod 600 "$BACKUP_PATH" || true

# --- Verify: file exists and has non-zero size --------------------------
if [ ! -s "$BACKUP_PATH" ]; then
  rm -f "$BACKUP_PATH"
  fail "backup file missing or empty after pg_dump"
fi

SIZE_BYTES=$(stat -c%s "$BACKUP_PATH" 2>/dev/null || stat -f%z "$BACKUP_PATH" 2>/dev/null || echo 0)

# --- Verify: integrity smoke check via pg_restore --list -----------------
if ! pg_restore --list "$BACKUP_PATH" > /dev/null 2>&1; then
  fail "pg_restore --list could not read the backup file — treating backup as corrupt"
fi

log "Backup verified OK (${SIZE_BYTES} bytes)"
write_metadata "ok" "$SIZE_BYTES"

# --- Retention (only runs once the backup above succeeded) ---------------
# Daily: delete dumps older than RETENTION_DAILY_DAYS.
# Weekly: keep one backup per week (the Monday-or-earliest-of-week run) for
# RETENTION_WEEKLY_WEEKS weeks; the rest of the "daily" prune above already
# clears same-week duplicates past the daily window.
log "Applying retention: daily=${RETENTION_DAILY_DAYS}d weekly=${RETENTION_WEEKLY_WEEKS}w"

find "$BACKUP_DIR" -maxdepth 1 -name 'aadhya-*.dump' -type f -mtime "+${RETENTION_DAILY_DAYS}" -print | while read -r old; do
  # Keep this file if it is the designated weekly-retained backup:
  # simplest safe rule — anything older than the weekly window (in days) is
  # removed outright; anything between the daily and weekly window is kept
  # only if it is the oldest backup captured within its ISO week.
  WEEKLY_WINDOW_DAYS=$(( RETENTION_WEEKLY_WEEKS * 7 ))
  AGE_DAYS=$(( ( $(date -u +%s) - $(stat -c%Y "$old" 2>/dev/null || stat -f%m "$old") ) / 86400 ))
  if [ "$AGE_DAYS" -gt "$WEEKLY_WINDOW_DAYS" ]; then
    log "Deleting expired backup (past weekly retention): $old"
    rm -f "$old"
    continue
  fi
  # Within weekly window: keep only the first backup seen per ISO week.
  WEEK_KEY=$(date -u -d "@$(stat -c%Y "$old" 2>/dev/null || stat -f%m "$old")" +%G-%V 2>/dev/null || echo "unknown")
  MARKER="${BACKUP_DIR}/.retained-week-${WEEK_KEY}"
  if [ -f "$MARKER" ]; then
    log "Deleting daily backup superseded by weekly retention: $old"
    rm -f "$old"
  else
    touch "$MARKER"
    log "Retaining as weekly snapshot for week ${WEEK_KEY}: $old"
  fi
done

# Clean up week markers older than the weekly retention window.
find "$BACKUP_DIR" -maxdepth 1 -name '.retained-week-*' -type f -mtime "+$(( RETENTION_WEEKLY_WEEKS * 7 ))" -delete 2>/dev/null || true

log "Backup and retention complete."
exit 0
