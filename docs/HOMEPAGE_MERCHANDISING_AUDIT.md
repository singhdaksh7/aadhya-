# Homepage Merchandising Audit

Date: 2026-09-29
Scope: Homepage product sections (New Arrivals, Best Sellers) and editorial/visual
cards (Shop the Look, Promo Banners 2-Up).

## 1. Root cause of New Arrivals not rendering

Two independent gaps combined to produce the symptom:

1. **`server/src/modules/pages/pages.service.js` `getPublicHomepage()`** returned
   `PageSection` rows straight from the DB. It never queried the `Product` table for
   `NEW_ARRIVALS` / `BEST_SELLERS` sections — the section `settings` JSON only ever
   held display copy (`eyebrow`, `title`, `ctaLabel`, `limit`), never the resolved
   products.
2. **`src/pages/Home.jsx`** called `fetchHomepage()` (`GET /pages/home`) and rendered
   `<HomepageRenderer sections={sections} />` — it never passed `newArrivals` /
   `bestSellers` (or `categories`, `featuredCollection`, `booksList`) even though
   `HomepageRenderer` accepts and renders them when present.

Neither `Product.isNewArrival` nor the admin checkbox nor the Prisma query filter
(`product.service.js` `buildWhere()`, correct field name `isNewArrival`) were
broken — the flag and the underlying product-listing query were always correct.
The bug was a pure data-wiring gap: nobody on the homepage path ever called the
product query with that filter and handed the result to the renderer.

## 2. Best Sellers

Same root cause, same fix. `isBestSeller` was likewise never queried for the
homepage. Fixed identically and by the same code path (see below) since both
section types share one resolver.

## 3. Data flow (after fix)

`GET /pages/home` → `pages.service.js getPublicHomepage()` → for every enabled
`NEW_ARRIVALS`/`BEST_SELLERS` section, `resolveProductSectionItems(section)`:
- **AUTO** (default): `prisma.product.findMany({ where: { isActive: true, isNewArrival: true (or isBestSeller) }, orderBy: { createdAt: "desc" }, take: limit })`.
- **MANUAL**: fetches `settings.productIds` (active only), preserves the stored
  order, silently drops ids that are missing/inactive/deleted.

Each section comes back from the API with a `products` array attached
(`{ ...section, products: items }`), batch-fetched — one query per section, not
per card (Part M). `src/lib/api.js fetchHomepage()` then runs those products
through the same `normalizeProduct()` boundary every other product list uses
(flattens nested `images` objects into URL strings, computes `inStock`, etc.) —
this step was missing and would otherwise have produced broken `<img>` tags even
after the query gap was fixed. `HomepageRenderer` reads `section.products` first,
falling back to the legacy `newArrivals`/`bestSellers` props for any caller/test
that still supplies them directly.

## 4. Hardcoded/default-image sections

`SHOP_THE_LOOK` ("Living Room Edit", "Mindful Corner", "Warm Neutrals", "Books &
Objects") and `PROMO_BANNERS_2UP` ("Warm Neutrals", "Gift Edit") are **already**
fully admin-controlled JSON-driven sections (`server/src/modules/pages/homepage-content.js`,
validated by zod schemas in the same file, edited via
`src/components/admin/HomepageSectionFields.jsx` using the existing
`ImagePickerInput`/media picker + crop system with 4:3/16:9/1:1 presets). The
Unsplash URLs that appear for these cards are only the **seed defaults**
(`DEFAULT_HOMEPAGE_CONTENT`), used when an admin hasn't overridden a card yet.
Once an admin edits a card and saves, `mergeMissingSettings()` never overwrites
their choice, and the new value (an uploaded media URL) renders in production.
This matches the requirement in Part H: an old stored remote URL keeps working;
new content goes through uploads. No further schema work was required for D1–D5
— target-type pickers for collection/category/page/custom URL, per-item
enable/image/crop, already exist per Part G.

## 5. Admin controls that already existed

- Section reordering (`adminReorderPageSections`), enable/disable, duplicate, delete.
- Field-driven settings editor (`HomepageSectionFields.jsx`) per section type,
  including image picker + crop for editorial cards and entity target pickers
  (collection/category/page/custom URL) for `SHOP_THE_LOOK` items.
- Server-side zod validation (`homepage-content.js`) rejecting unsafe URLs,
  over-length text, bad enum values.

## 6. What needed schema vs config-only changes

**Config-only.** No Prisma migration was needed. `PageSection.settings` is a
`Json` column; `NEW_ARRIVALS`/`BEST_SELLERS` schemas were extended (in
`homepage-content.js`) with `sourceMode: "AUTO" | "MANUAL"` and
`productIds: string[]` — both optional, backward compatible with every existing
row. `mergeMissingSettings()` backfills these only when absent, so existing
production sections are untouched until an admin opts into MANUAL mode.

## 7. Risks / migration needs

- No migration required; change is purely in application code + JSON schema.
- Adding `resolveProductSectionItems()` adds up to 2 extra queries to
  `GET /pages/home` (one per product section) — negligible, and still far
  cheaper than one query per card.
- MANUAL mode silently drops inactive/deleted product ids rather than erroring,
  so a stale admin selection degrades gracefully instead of breaking the
  homepage.
- `HomepageRenderer` now hides `NEW_ARRIVALS`/`BEST_SELLERS`/`BOOKS_SHELF`
  sections entirely when their resolved list is empty (Part A3/K) — this is a
  behavior change from before (which would have shown an empty grid) and one
  existing test (`HomepageDynamicContent.test.jsx`) was updated to reflect it.
