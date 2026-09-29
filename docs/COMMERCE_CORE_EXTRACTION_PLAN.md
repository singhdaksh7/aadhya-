# Commerce Core Extraction Plan (future, not implemented)

This documents a possible future structure if/when running many independently
deployed stores from one codebase becomes painful to maintain as a single app. **Not
implemented in this pass** — deliberately, per the brief: no monorepo rewrite now.

## Proposed future structure

```
apps/
  api/            # current server/, unchanged internally
  admin/          # current admin pages under src/pages/admin/, split out
  storefront/     # current customer-facing src/pages/*, split out

packages/
  commerce-core/  # Product/Order/Cart domain logic, Prisma schema/client
  payments/       # PaymentProvider interface + Razorpay implementation
  shipping/       # ShippingProvider interface + Shiprocket/Manual implementations
                   #   (server/src/modules/shipping/provider.service.js is already
                   #    shaped like this — extraction would mostly be a file move)
  invoicing/       # Invoice generation, PDF writer, tax calc
                   #   (server/src/modules/invoices/* is already fairly self-contained)
  email/          # EmailProvider interface + SMTP implementation
  media/          # Upload/storage abstraction (local disk vs S3 — already exists as
                   #   server/src/config/env.js's `storage` block + upload handlers)
  auth/           # JWT/admin-auth logic
```

## Why not now

- The existing module boundaries under `server/src/modules/*` already map cleanly onto
  this future package split (shipping, invoices, integrations are each fairly
  self-contained today) — extraction later is a mechanical move, not a redesign.
- A monorepo split adds real overhead (build tooling, versioning, cross-package
  publishing) that only pays off once there are actually 2+ deployed stores sharing
  the core. Today there is one store (Aadya) plus a documented bootstrap process for a
  second — premature extraction would be speculative infrastructure for a
  not-yet-real second deployment.

## What would trigger doing this for real

Standing up a genuinely second store (not a hypothetical) and finding that keeping
both in sync as copies of one repo becomes error-prone — at that point, extract
`packages/commerce-core` and `packages/shipping`/`invoicing`/`payments` first (the
already-isolated modules), publish them as private packages or git submodules, and
have `apps/api` for each store consume them. `apps/admin` and `apps/storefront` can
stay per-store forks for longer since branding/UX legitimately diverges per store.

## Provider abstractions: current state vs target

- **ShippingProvider**: already matches the target shape (`createShipment`,
  `generateAwb`, `schedulePickup`, `getLabel`, `track` via `getTracking`, `cancel` via
  `cancelShipment`) in `provider.service.js`. No further abstraction work needed to
  extract this into a package later.
- **PaymentProvider**: `payment.service.js` is Razorpay-specific with no interface
  layer today (see `REUSABLE_COMMERCE_CORE_AUDIT.md`). Extracting this would require
  defining the `createOrder`/`verifyPayment`/`refund`/`verifyWebhook` interface first
  and refactoring the existing Razorpay calls behind it — not done this pass (no second
  gateway to verify against, and it's higher-risk payment-adjacent code).
- **EmailProvider**: `email.service.js` wraps SMTP directly; a thin `send()` interface
  would be a small, low-risk extraction whenever this plan is acted on.
