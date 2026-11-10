# Aadya / Tushaqsa — Production status

Snapshot taken 2026-11-10. No credentials or secrets belong in this file.

## Production
- Deployed SHA: `6890a8e` (PR #115). Later `main` commits that only touch docs/tests do not require a deploy.
- Storefront: `https://tushaqsa.aadyavocational.com` (also `aadyavocational.com`, `www.`)
- API: `https://api.aadyavocational.com/api`
- Host: single VPS, app in `/opt/aadya`, compose project `aadya`, behind Traefik.
- Services: `aadya-web`, `aadya-api`, `aadya-db` (Postgres). Compose is run with
  `docker compose --env-file .env.production -f docker-compose.prod.yml ...`.
- `docker-compose.prod.yml` on the server has local, uncommitted edits. Never `git checkout`/`reset` it; `git pull --ff-only` is safe while upstream does not touch it.
- Rebuild only what changed: `up -d --build --no-deps aadya-api aadya-web`. Do not restart `aadya-db` or Traefik for app deploys.
- Backups: `/opt/aadya/backups` (DB dumps, uploads tarballs, per-deploy snapshots). Take a `pg_dump -Fc` before any deploy that touches data.

## Major modules
| Module | Notes |
| --- | --- |
| Catalog / shop / categories / collections | Public pages; collections can be rule-based (price range, etc.) |
| Product admin | Full edit form, specifications, variants, shipping package fields, book formats |
| Product duplicate | `POST /admin/products/:id/duplicate`: draft, stock 0, new slug/SKUs, new ProductImage rows, same image URLs |
| Image gallery | PDP arrows, swipe, counter, zoom lightbox; cards use optimized derivatives |
| Cart / checkout | Server-priced; Cashfree payments, COD where enabled |
| Coupons / offers | Public and private coupons, `/offers`, What's New |
| Gifting | `/gifting` fully CMS-driven from Admin > Gifting (section builder + page SEO); homepage visibility switch `showGiftingOnHomepage` |
| Bulk gifting | Public form -> `BulkGiftingInquiry` row (always persisted) -> background email to configured admin notification recipients; Admin > Bulk Inquiries |
| Marketing | Popup, reel modal, category banners |
| Shiprocket | Forward fulfilment: package confirm, serviceability, courier pick, order + AWB, pickup, tracking webhook, customer tracking, cancellation, failure alerts |
| Footer CMS | Links, logo, SEO text, artwork block (see below) |

## Operational notes
- **Product images are referenced by URL string** (`ProductImage.url`, `Product.ogImage`, `MediaAsset.url`), so several products can share one file (duplicates do).
  A file is physically deleted only when no ProductImage, ogImage or MediaAsset still references it
  (`server/src/modules/uploads/mediaReferences.js`). Media Library delete returns 409 "used by N products" and `force` cannot override it.
- **Image delivery:** `/uploads/products/<file>?w=320|480|640|800|1200` serves cached WebP derivatives; originals are never modified, so large originals are archival and not sent to shoppers. See `docs/media-pipeline.md`.
- **Image audit:** `docker exec aadya-api node scripts/audit-product-media.js` (read-only). Reports missing files, oversized originals, ogImage refs and URLs shared by several products. Run before any uploads-volume cleanup.
- **Package dimensions:** product/variant shipping fields are stored as grams and millimetres; the admin form uses kg and cm. Variants inherit the product's package data when blank.
- **Shiprocket mode:** `provider` MANUAL vs SHIPROCKET and `autoFulfilSingleItem` live in shipping settings. Auto-fulfilment only handles one physical product, quantity 1, complete package data; anything else is manual from the order page. A failed auto attempt is not retried automatically.
- **Footer artwork:** setting `footer.artwork`. Currently `enabled: false` (feature ready; enabling and choosing artwork is an owner content decision). Controls: desktop/mobile image, fit, heights, focal X/Y, offset.
- **Gifting on homepage:** off by default; one switch in Homepage Builder / Gifting settings.

## Known optional items
- Reverse Shiprocket (return pickups) is **not implemented**. Return/reverse pickups are handled manually in the Shiprocket dashboard.
- Live variant verification: there are currently no products with variants in production. Variant flow is covered by automated tests; verify live on the first real variant product.
- Oversized original images (about half of all rows). Delivery uses derivatives, so this is not a correctness issue. A separate future task could re-compress originals.

## Known owner actions
- One live product, "Rose Pink Print - Handblock File Folder" (`yellow-pink-floral-handblock-file-folder-1`), has its 5th gallery image missing from disk. It is in no backup. The original 5th image must be re-uploaded in Admin > Products. The storefront already hides it.
- Wishlist new-tab behaviour on phones is automated-tested; a manual check with a real customer login remains.
