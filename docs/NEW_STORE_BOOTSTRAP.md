# New Store Bootstrap

How to stand up a second independent store (e.g. a jewellery or clothing brand) from
this codebase. Each store is a fully separate deployment — its own database, its own
`.env`, its own Razorpay/Shiprocket/SMTP accounts. This is NOT multi-tenancy: there is
no shared database or shared admin between stores.

1. **Clone the repo** into a new working copy per store (or a new deploy branch if you
   prefer one repo with per-store deploy targets — either works since nothing here is
   tenant-scoped).

2. **Env setup**: copy `server/.env.example` → `server/.env` and `.env.example` →
   `.env`/`.env.production` at the repo root. Fill in every value — see `.env.example`
   for the full documented list (Database, Auth/JWT, Encryption, Uploads/Storage,
   Shipping defaults, Razorpay, Shiprocket via the admin UI post-deploy, SMTP).

3. **Database**: provision a fresh PostgreSQL database. Set `DATABASE_URL`. Do not point
   two stores at the same database.

4. **Prisma migrate deploy**: `cd server && npx prisma migrate deploy`. Never `prisma db
   push` in a store you intend to keep — always forward-only migrations.

5. **Create admin**: set `ADMIN_NAME`/`ADMIN_EMAIL`/`ADMIN_PASSWORD` in `.env`, run
   `npm run seed` (add `SEED_DEMO_CATALOG=true` only for a throwaway dev/demo store —
   leave it unset for anything meant to hold real inventory).

6. **Business settings**: log into `/admin`, go to Store Settings and set store name,
   legal business name, logo, favicon, support email/phone, registered address, social
   links, invoice prefix, timezone, default country. These are `SiteSetting` rows — no
   code change needed.

7. **Appearance**: set homepage banners/pages/theme via the admin CMS pages
   (`Page`/`PageSection`/`Banner` models) — content-driven, no code change needed.

8. **Invoice / GST settings**: Admin → Invoice Settings — set seller GSTIN, PAN, state
   (for intra/inter-state detection), bank details, invoice numbering prefix, upload
   logo and authorized-signature images (now rendered as real embedded images in the PDF
   when stored on local disk — see the S3 caveat in `.env.example`).

9. **Razorpay**: Admin → Integrations — enter live/test key ID, key secret, webhook
   secret. Configure the Razorpay dashboard webhook URL to point at this deployment.

10. **Shiprocket**: Admin → Integrations — enter Shiprocket account email/password,
    environment, webhook secret. Use "Test Connection" to verify before going live.
    Then Admin → Shipping Settings — fill in the pickup location (name, contact,
    address, city/state/postal/country) *before* any live order tries to create a
    shipment (the server now rejects shipment creation with a clear 400 if pickup
    details are incomplete). Set `autoCreateShipment`/`autoGenerateAwb`/
    `autoSchedulePickup` according to how hands-off you want fulfilment to be.

11. **SMTP**: set `SMTP_HOST`/`PORT`/`USER`/`PASS`/`FROM` in `.env`. Leave blank in a
    dev/demo store — email sending fails gracefully and logs instead of blocking
    checkout.

12. **Catalog import**: create categories, then products (with HSN code, GST rate, unit,
    tax-inclusive/exclusive mode set per product for correct invoicing), or bulk-import
    if a CSV import tool exists in the admin — check `AdminProductList.jsx`/related
    routes for current import support before assuming it exists.

13. **Deployment**: build and deploy per your hosting target. This document does not
    prescribe a host — see `COMMERCE_CORE_EXTRACTION_PLAN.md` for how this could later
    split into separately deployable `apps/`. For now it's a single deployable app;
    deploy the whole repo per store.

14. **Smoke test** before going live: place a real test order end-to-end (checkout →
    payment → invoice generated/emailed → admin can see the order → Create Shipment →
    Generate AWB → tracking updates flow through the webhook). Confirm the invoice PDF
    shows the correct GSTIN/logo/signature and the correct intra/inter-state tax split
    for a same-state and a different-state test address.
