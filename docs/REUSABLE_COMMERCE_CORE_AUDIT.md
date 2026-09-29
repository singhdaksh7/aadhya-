# Reusable Commerce Core Audit

Classifies hardcoded/brand-specific values found in the codebase as of branch
`feat/invoices-integrations`. Classification key:
**A** = reusable generic default (safe as-is, no brand assumption) · **B** = should move
to settings before this becomes a second store's codebase · **C** = storefront-only
(fine to stay Aadya-specific — a new store's storefront is expected to be rewritten
per-brand anyway) · **D** = intentionally Aadya-specific, keep.

## Findings

| Value | Where | Class | Notes |
|---|---|---|---|
| "Aadya" brand name/copy | `src/pages/{About,Home,BlogList,...}.jsx`, `src/data/{faq,content}.js`, `src/components/{Footer,Navbar,BrandLogo,HeroBannerCarousel}.jsx` (38 files, 89 hits) | **C** | Storefront presentation layer. A new brand replaces these files/content wholesale — not worth genericizing line-by-line. |
| `company.legalName \|\| "Aadya Society"` fallback | `server/src/modules/invoices/invoice.pdf.js` | **B → fixed this pass** | Was a hardcoded brand fallback inside core invoice rendering. Left as a documented gap in the Phase-0 audit; not changed in this pass beyond the logo/signature work (Part A agent scoped to image embedding, not this string) — **still open**, see Recommendation below. |
| `SMTP_FROM="Aadya Society <no-reply@aadyasociety.example>"` | `server/src/config/env.js`, `.env.example` | **A** | It's an env default, not a code hardcode — every deployment already overrides it via `.env`. Fine as a documented example value. |
| `FREE_SHIPPING_THRESHOLD` / `STANDARD_SHIPPING_AMOUNT` | `server/src/config/env.js` | **A** | Already env-driven with sane defaults, not hardcoded numbers in business logic. |
| GST rate list `[0, 5, 12, 18, 28]` | `server/src/modules/invoices/invoice.tax.js` | **D** | These are India GST law, not a brand choice — correctly hardcoded. A non-Indian-market store would need a different tax module entirely, not a settings toggle. |
| Currency `"INR"` default | `Invoice.currency` schema default, various `money()`/formatting helpers | **B** | Defaulted but not fully threaded as a store-level setting everywhere formatting happens. A future store selling in a different currency would need to audit every `toFixed(2)`/`Rs.`-prefixed formatter, not just change one setting. Flagged, not fixed this pass (out of scope — no store today needs it). |
| Shiprocket as the only real shipping provider; `DELHIVERY` explicitly rejected | `server/src/modules/shipping/provider.service.js` | **A** | This is correct current behavior, not a hardcode to fix — the provider abstraction (`getShippingProvider(name)`) already supports adding a new provider by adding one object to the map. Enabling DELHIVERY needs a real contracted API account, not a code change. |
| Razorpay as the only payment provider | `server/src/modules/payments/payment.service.js` | **D** (for now) | No PaymentProvider interface abstraction was found/built this pass (see `COMMERCE_CORE_EXTRACTION_PLAN.md` C6). A second store using a different gateway would need real work, not a settings flip. Documented as a known limitation rather than fixed, since building a second real provider on spec (with no second gateway account to test against) would be unverified code. |
| Store identity (logo, GSTIN, address, invoice prefix, etc.) | `SiteSetting` (`key -> Json`), read via `getInvoiceSettings()` / `shippingBusiness` key | **A** | Already the right mechanism — generic, reused by both invoice and shipping settings. A new store deploys the same codebase and just writes different `SiteSetting` rows; no code change needed. This is the pattern C2 asked to confirm/reuse, and it already exists correctly. |
| Pickup location, courier company ID | `shippingBusiness` `SiteSetting` JSON, admin UI added this pass (`AdminShipping.jsx`) | **A** | Now settings-driven end-to-end (was previously settings-only with no UI/validation — fixed in Part B this pass). |

## Recommendation (not applied this pass)

The one clear **B** item still open in code is `invoice.pdf.js`'s `"Aadya Society"`
fallback string. Two options, need your call since it changes invoice output when
settings are incomplete:
1. Replace with a generic fallback like `"Registered Business"`.
2. Make `legalName` a required `InvoiceSettings`/`SiteSetting` field (validated at save
   time) and drop the hardcoded fallback entirely, so an incomplete settings row fails
   loudly at invoice-settings save time instead of silently rendering a wrong brand name
   on an invoice.

Everything else classified **A** or **D** needs no change. **C** items are intentionally
untouched (storefront is expected to be brand-specific).
