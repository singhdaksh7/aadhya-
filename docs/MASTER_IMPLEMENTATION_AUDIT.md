# Master Implementation Audit

Scope: Phase 0 audit only, per the coordinated GST-invoice / Shiprocket / reusable-core
initiative. No code was changed for this pass. Produced against branch
`feat/invoices-integrations` (HEAD `b1b55ad`), which is materially ahead of `main` on
exactly this work — the invoice/GST commits already on this branch cover most of what
the brief calls "current implementation," so this audit treats this branch as the
baseline rather than re-auditing an older `main`.

## 1. Invoices / GST

**Files:** `server/src/modules/invoices/{invoice.service.js, invoice.tax.js, invoice.pdf.js,
invoice.storage.js, invoice.routes.js, manualInvoice.service.js}`, `prisma/schema.prisma`
(`Invoice`, `InvoiceSequence` models).

Already solid and should not be replaced:
- Financial-year invoice numbering via `InvoiceSequence`, allocated through one shared
  `allocateInvoiceNumber()` helper used by both the automatic (online order) and manual
  (admin-authored) flows.
- Manual invoices have a clean DRAFT → ISSUED lifecycle; DRAFT rows are freely editable
  and excluded from the sequence, ISSUED rows are frozen and numbered the same way
  automatic invoices are.
- Full immutable snapshotting: `companySnapshot`, `taxSnapshot`, `itemsSnapshot` are Json
  columns captured at issue time. PDF regeneration (`regenerateInvoicePdf`) reads only
  from the snapshot, never from live Product/Settings/Order state — historical
  immutability (A8) is already correctly implemented, not just intended.
- GST field validation (`invoice.tax.js`): GSTIN, HSN, state-code, and GST-rate
  (0/5/12/18/28) pattern checks, used by product and settings forms.
- CGST/SGST vs IGST split, tax-inclusive/exclusive pricing mode per item
  (`taxPricingMode`), all computed server-side.

Confirmed incomplete (matches the brief's A1/A2/A6):
- **Logo/signature are NOT embedded as images.** `invoice.pdf.js` is a small hand-rolled
  PDF-1.4 writer (no external library, by design — see its file-header comment) that
  currently renders `company.logoUrl` / `company.signatureUrl` as a literal text string
  (`[Logo: ...]`, `[Signature: ...]`) rather than a PDF image XObject. This is exactly
  the placeholder behavior the brief describes for A1/A2. Embedding a real raster image
  means adding JPEG/PNG XObject support (DCTDecode for JPEG is trivial; PNG needs a
  raw/FlateDecode path) to this writer, resolving the stored logo/signature file through
  existing media storage (not a public filesystem path), and falling back to text when
  the file is missing/corrupt/unreadable — none of that exists yet.
- **GST summary table is single-rate only.** The current "Tax Summary" block in
  `invoice.pdf.js` assumes one blended rate across the whole invoice (it sums all
  `taxableValue` into one `taxableTotal` and prints one CGST+SGST or one IGST row from
  `taxSnapshot.rate`). A6's "group by GST rate" (multiple rows for 5%, 18%, etc. when an
  invoice mixes rates) is not implemented — would need grouping `itemsSnapshot` by
  `gstRate` at snapshot time or render time.
- **No live tax preview in the admin manual-invoice UI** (A3). Backend computation
  (`computeItemTaxLine`, `getInvoiceSettings`) is already correct and reusable — the gap
  is purely a missing frontend preview component under `src/pages/admin` that calls the
  same logic (or a preview endpoint) before submit.
- **No explicit "Intra-state supply" / "Inter-state supply" label** in the admin UI (A4).
  `manualInvoice.service.js` already computes `isInterState()` server-side; it's just not
  surfaced as UI text anywhere found.
- **No explicit "Tax Inclusive" / "Tax Exclusive" per-item UI badge** (A5), though the
  underlying `taxPricingMode` field exists on Product and is used in calculation.
- **Rounding parity (A7)** is currently a non-issue only because there is no frontend
  calculation to drift from backend (no live preview exists yet). Once A3 is built, the
  frontend preview must call a shared rounding helper (or hit a real preview endpoint)
  rather than reimplement its own rounding in JS.

Existing test coverage: none found yet for logo/signature rendering, fallback, GST
summary grouping, or snapshot-immutability regression — these are real gaps, not just
missing features.

## 2. Shiprocket / Shipping

**Files:** `server/src/modules/shipping/{provider.service.js, fulfilment.service.js,
webhook.controller.js, shipping.service.js, shipping.routes.js, shipping.validators.js}`,
`server/src/modules/integrations/{credential.service.js, integration.routes.js,
integration.validators.js}`, `prisma/schema.prisma` (`Shipment`, `IntegrationCredential`).

This is considerably more complete than the brief's Phase-0 framing assumes — it is not
a stub. Already implemented, correctly:
- `provider.service.js` defines a real `ShippingProvider`-shaped abstraction (`manual` and
  `shiprocket` objects implementing `createShipment`, `generateAwb`, `schedulePickup`,
  `getTracking`, `getLabel`, `cancelShipment`, `verifyWebhook`, `testConnection`) behind
  `getShippingProvider(name)`. A `DELHIVERY` provider is explicitly stubbed to throw with
  a clear reason rather than silently no-op — good pattern to keep.
- Shiprocket auth (`shiprocketRequest`) logs in against the real API per-call using
  stored credentials rather than caching a long-lived token — correct for a stateless
  server but worth noting as a minor perf item (B1/B12 territory), not a correctness bug.
- Credentials (`credential.service.js`) are AES-256-GCM encrypted at rest
  (`INTEGRATION_ENCRYPTION_KEY`), write-only via `saveCredential`, and `safeCredential()`
  only ever returns masked last-4 values for a fixed `secretNames` allowlist — B1's
  "secrets write-only, masked after save, never returned" requirement is already met.
  Every credential mutation writes an `AdminAuditLog` row.
- `fulfilment.service.js`: `attemptAutomaticShipment` is idempotent via the DB's
  `orderId` unique constraint on `Shipment` (a concurrent second call collides on
  `prisma.shipment.create` and falls back to reading the existing row) — this already
  satisfies B3's "prevent duplicate provider shipments" and B11's "no detached promise
  race conditions" (the whole path is `await`ed, not fire-and-forget).
  `attemptAutomaticShipment` is gated by `settings.autoCreateShipment` from
  `SiteSetting.shippingBusiness`.
- RTO handling: `applyTrackingUpdate` awaits `handleRtoDelivered` (in
  `returns.service.js`, not yet read in this pass) directly in-line specifically to avoid
  a past fire-and-forget race bug (see inline comment) — but failures are caught and
  logged, not allowed to fail the webhook response. Needs to be verified against B9's
  exactly-once restock / prepaid-REFUND_PENDING / COD-close split by reading
  `returns.service.js` in the next pass.
- Webhook (`webhook.controller.js`): HMAC-SHA256 signature verification via
  `timingSafeEqual`, 401 on missing/invalid signature, idempotency via a `WebhookEvent`
  unique-constraint row (duplicate delivery returns `{received:true, duplicate:true}`
  without reprocessing) — B8's verification/idempotency/duplicate-handling requirements
  are already met as written.
- Status normalization (`normalizeShippingStatus`) maps raw provider strings to an
  internal set; current set is `PENDING, PICKED_UP, PICKUP_SCHEDULED, IN_TRANSIT,
  OUT_FOR_DELIVERY, DELIVERED, FAILED_ATTEMPT, RTO, RTO_DELIVERED, CANCELLED`. This is
  close to but not identical to the brief's suggested set (no `CREATED` /
  `AWB_ASSIGNED` / `RTO_INITIATED` / `RTO_IN_TRANSIT` as distinct states — `RTO` covers
  both). Changing this is a judgment call with data-model impact, not a pure bug fix —
  worth confirming with you before altering, since it would touch an enum-like string
  used across Shipment rows.

Confirmed incomplete / unverified (needs follow-up reads before Part B implementation):
- Admin order UI (B10) — not yet located; needs a search under `src/pages/admin` for an
  order-detail shipment panel with the Create Shipment / Generate AWB / Schedule Pickup /
  Download Label / Refresh Tracking actions and their disabled-state logic.
- Pickup-location settings validation (B2) — `settings.pickup` is read and used but the
  admin settings form and required-field validation weren't located in this pass.
  `Test Connection` UI on the Integrations page not yet verified end-to-end.
  autoGenerateAwb / autoSchedulePickup — `autoCreateShipment` confirmed in
  `fulfilment.service.js`; the other two flags need to be traced (their existence in
  `SiteSetting.shippingBusiness` is implied by the brief but not yet confirmed by reading
  the settings schema/UI).
- `server/tests/shiprocket-adapter.test.js` exists and looks reasonably thorough
  (covers auth, credential save/mask, `buildShipmentPayload`,
  `attemptAutomaticShipment`) — exact coverage against the brief's full required-test
  list (duplicate shipment, AWB, pickup, label, webhook duplicate, RTO prepaid/COD,
  provider failure) not yet line-by-line verified.

## 3. Settings / Genericization Surface

- `SiteSetting` (`prisma/schema.prisma:923`) is a simple `key -> Json value` table,
  already used for `shippingBusiness` and (by convention, not yet confirmed) likely an
  `invoiceSettings`/`companySnapshot`-source key. This is a reasonable existing
  generic-settings mechanism — Part C's "reuse existing settings models, avoid duplicate
  config systems" should target this table, not a new model.
- No dedicated `InvoiceSettings` or multi-field Prisma model was found — invoice company
  data appears to live inside `SiteSetting` as Json (consistent with `companySnapshot`
  being freeform Json on `Invoice`). Confirming the exact key/shape needs one more read
  of `settings.routes.js` and `invoice.service.js::getInvoiceSettings` before Part C
  writes anything.
- "Aadya" is referenced in 13 server files and 38 frontend files (89 occurrences) — this
  is storefront/content-layer copy (About page, FAQ data, homepage content, blog,
  footer, brand logo component) plus some server defaults (email templates, password
  policy messaging, invoice PDF's fallback legal name `"Aadya Society"`). Per the brief's
  own framing (storefront may remain Aadya-specific; only admin/core defaults need to
  move to settings), the invoice PDF's hardcoded fallback name in `invoice.pdf.js:47`
  (`company.legalName || "Aadya Society"`) is the one hit found so far that's arguably
  core-not-storefront and worth moving to a generic fallback ("Registered Business") or
  requiring `legalName` in settings with no hardcoded brand fallback at all — a decision
  for you, since it changes what an invoice looks like if settings are incomplete.
- Full classification (A/B/C/D per the brief's C1) was not done in this pass — 38+13
  files is enough surface that it deserves its own dedicated audit pass
  (`docs/REUSABLE_COMMERCE_CORE_AUDIT.md`) rather than being rushed here.

## 4. What This Pass Did Not Cover

Not yet read/audited: `returns.service.js` (RTO restock/refund logic), admin settings
routes/UI for invoice company details and shipping pickup location, admin order detail
UI, Product attribute/variant architecture (`ProductVariant`, `ProductBookDetails` exist
in schema but weren't inspected for genericity), `.env.example` completeness, existing
Prisma migration history, and the full test suite run. These are exactly the inputs
needed before Parts A/B/C can be implemented safely and are the recommended next steps.

## 5. Recommended Next Step

Given the size of the full brief (GST PDF image embedding + live preview, full
Shiprocket admin UI audit, RTO refund logic verification, and a repo-wide
genericization pass with its own docs), doing all of it in one pass risks unverified,
half-tested changes to payment/refund-adjacent code. Suggest picking one part (A or B)
to implement and test fully before starting the next, rather than attempting all three
in one sweep.
