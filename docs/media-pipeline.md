# Product media pipeline (why product cards stay fast)

Incident (Nov 2026): shop cards showed blank areas and alt text. Causes: 46 DB image rows whose files were gone from
the uploads volume (404), full-size multi-MB PNGs on small cards, no `onError` handling, uncompressed API JSON.

Guards now in place
- Upload cap: images over 2 MB are rejected by the API (`IMAGE_MAX_MB`) and blocked client-side in admin with a clear message.
- Delivery: `/uploads/products/<file>?w=320|480|640|800|1200` serves a cached WebP derivative (`uploads/products/.variants`).
  Originals are never modified. `server/scripts/backfill-image-variants.js` pre-generates them (idempotent).
- Storefront: `CardImage` = skeleton -> srcset/sizes image -> next image on error -> branded placeholder (no alt text ever painted).
  First two catalog cards eager, rest lazy. Hover image is mounted only after the first hover.
- Public API omits image rows whose local file is missing, so shoppers never request dead URLs.
- Detection: `docker exec aadya-api node scripts/audit-product-media.js` (read-only) lists MISSING_FILE / OK_OVERSIZED rows
  and products with no working image. Run it weekly and before any cleanup of the uploads volume.
  (A daily cron is recommended; it was not installed automatically.)

Rules
- Never delete files from the `aadya_uploads` volume by hand; run the audit first. Keep the volume in backups.
- If the audit reports PRODUCT_WITHOUT_WORKING_IMAGE, re-upload photos in Admin > Products > Images.
