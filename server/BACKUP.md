# Backup strategy (documentation only — no backup job is implemented or run by this doc)

## PostgreSQL

- Take automated daily logical backups with `pg_dump --format=custom` (or use your hosting provider's managed-Postgres automated snapshot feature if the DB is on RDS/Render/Supabase/etc — prefer that over a hand-rolled cron job where available).
- Retention: keep daily backups for 14 days, weekly for 8 weeks, monthly for 12 months. Adjust to your actual compliance/retention needs.
- Store backups in a separate cloud region/account from the primary DB, encrypted at rest (S3 with SSE, or your provider's equivalent).
- Test restores quarterly at minimum — a backup that has never been restored is unverified. Restore into a scratch DB and run `npm test`'s migration step (`prisma migrate deploy`) against it as a sanity check that the schema is consistent.
- Before any risky migration, take an on-demand backup in addition to the schedule.
- Point-in-time recovery (PITR): if your Postgres provider supports WAL-based PITR, enable it — it covers the gap between scheduled dumps in case of an incident close to (but before) the next scheduled backup.

## Uploads / media (`server/uploads/products` — public product images)

- These are served directly and are not sensitive, but are still original content that would be costly to recreate.
- If using local disk storage (the `local` driver in `storage.js`): back up the `uploads/` directory with the same cadence as the DB (daily), since DB rows reference filenames that only make sense with the matching files present.
- If using the `s3` driver: enable versioning + cross-region replication on the bucket instead of a separate backup job — S3 versioning already gives point-in-time recovery for accidental overwrites/deletes, and replication covers region loss.
- Either way, back up in lockstep with the DB dump (same schedule) so a DB restore and a media restore taken at the same time stay consistent — a `ProductImage.url` row pointing at a file that a mismatched restore doesn't have is a broken-image bug, not a security issue, but still worth avoiding.

## Private book PDFs (`server/private/books` — local driver — or the `private/books/` S3 prefix)

- Higher priority than public media: these are paid digital goods with no other copy once uploaded (the admin who uploaded a PDF may not have kept a local copy).
- Same cadence as the DB (daily), but treat restore access more carefully: whoever can restore this backup can read every customer's purchased PDF content, so backup storage for this specific bucket/directory should have the same or stricter access control as the production `private/books` store itself (least-privilege IAM role scoped to only that prefix, not blanket S3 access; encrypted at rest).
- If using the S3 driver, the same versioning + replication approach as public media applies, again scoped to the `private/books/` prefix with its own bucket policy — do not rely on the public-media bucket's (potentially more permissive) policy for this prefix.
- Do not include raw PDF backups in any log-shipping or debugging bundle that goes to a support/dev tool with broader access than production — `SECURITY.md` already documents that the storage key itself is never returned by the API; the same discipline applies to backup handling.

## What is explicitly out of scope for this document

- No backup job, cron, or infra was created or run as part of this audit. This is a plan to implement, not a report of something already running — check `docker-compose`/hosting provider config to see whether any of the above is actually wired up yet, and treat "not yet automated" as the default assumption until verified.
