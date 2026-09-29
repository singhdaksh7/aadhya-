# Restoring a production backup

Backups are created by `scripts/backup-production.sh` using `pg_dump -Fc`
(custom format), stored as `aadhya-<UTC timestamp>.dump` in `BACKUP_DIR`.

## Golden rule

**Never restore directly over a live/production database.** Always restore
into a disposable/throwaway database first, verify the app works against it,
and only then decide — as an explicit, separate, confirmed action — whether
and how to point production at recovered data (and even then, prefer
restoring into a fresh database and cutting over, rather than restoring
in-place over the live one).

## Step 1 — Create a disposable database

```bash
createdb -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" aadhya_restore_check
```

## Step 2 — Restore the dump into it

```bash
PGPASSWORD=*** pg_restore \
  -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" \
  -d aadhya_restore_check \
  --no-owner --no-privileges \
  /path/to/aadhya-20260101T021500Z.dump
```

- `--no-owner --no-privileges` avoids failures if the restoring role differs
  from the role that created the dump.
- Add `-j 4` (or similar) to parallelize restore of large dumps.

## Step 3 — Sanity-check before trusting it

```bash
# Confirm the dump's table of contents is readable:
pg_restore --list /path/to/aadhya-20260101T021500Z.dump | head -50

# Spot-check row counts in the disposable DB:
psql -h "$PGHOST" -U "$PGUSER" -d aadhya_restore_check \
  -c "select count(*) from \"Order\";"
```

## Step 4 — Migration compatibility

The dump captures the schema **as it was at backup time**. Before pointing
any application code at a restored database, check whether Prisma
migrations have moved forward since the backup was taken:

```bash
npx prisma migrate status --schema server/prisma/schema.prisma
```

- If migrations were applied to production after the backup, the restored
  database is behind — running `npx prisma migrate deploy` against it will
  attempt to catch it up, but any migration that transforms or backfills
  data (not just DDL) may behave differently against older rows. Review
  each pending migration's SQL before applying.
- If the *application code* has moved forward (new required columns,
  renamed fields) relative to the backup's schema version, do not point a
  running app instance at the restored DB until migrations have been
  applied and validated (`npx prisma validate`).
- Never run `prisma migrate reset` against anything other than the
  disposable restore-check database.

## Step 5 — Only then, a real cutover (separate, explicit, confirmed action)

If after steps 1–4 a real recovery is needed:

1. Get explicit sign-off from whoever owns the production database.
2. Take a *fresh* backup of the current (possibly broken) production DB
   first, so the pre-recovery state isn't lost either.
3. Prefer promoting a newly-restored database (e.g. renaming/repointing the
   connection string) over `pg_restore` directly into the live database.
4. Run the app's smoke tests against the new database before flipping
   traffic to it.

## Cleanup

```bash
dropdb -h "$PGHOST" -U "$PGUSER" aadhya_restore_check
```
