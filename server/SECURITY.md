# Security notes for production launch

## JWT / token secret rotation

Env vars that hold signing secrets today:

- `JWT_ACCESS_SECRET` — signs admin **and** customer access tokens (both audiences share this secret; the `audience` claim inside the JWT, not a different key, is what separates them).
- `JWT_REFRESH_SECRET` — signs the admin refresh JWT (`src/utils/tokens.js` `signRefreshToken`/`verifyRefreshToken`).
- Customer refresh sessions are **not** JWTs — they are opaque random tokens (`crypto.randomBytes(32)`), stored server-side as a SHA-256 hash in `CustomerRefreshSession.tokenHash`. There is no separate "customer refresh secret" to rotate; revoking those sessions is a database operation (see below), not a key rotation.

**Any of these values may have been exposed during development** (checked into a shared `.env`, pasted into a chat, etc.) and should be rotated before real launch. Rotate access/refresh JWT secrets independently — they're different env vars, so there's no coupling.

### How to rotate `JWT_ACCESS_SECRET` safely

Every access token is short-lived (`JWT_ACCESS_EXPIRES_IN`, default 15m). Rotating this secret means every access token issued under the old secret stops verifying. In practice:

1. Deploy the new `JWT_ACCESS_SECRET`.
2. Any request carrying an old access token gets a 401 and the client's normal "access token expired" path kicks in — it calls the refresh endpoint (`/api/auth/refresh` or `/api/customer/auth/refresh`), which mints a **new** access token signed with the new secret, using the refresh token/session (which is validated against `JWT_REFRESH_SECRET` or the DB — untouched by an access-secret rotation).
3. Net effect: at most a 15-minute window where a stale access token 401s once and silently refreshes. No forced logout.

If you want zero visible disruption even inside that window, see "Grace-period rotation" below and apply it to the access secret too (the app doesn't currently check a previous access secret, but the pattern is identical to the refresh case).

### How to rotate `JWT_REFRESH_SECRET` safely (grace period)

This is the one that matters more, because rotating it naively invalidates every admin's refresh token immediately, forcing every admin to log in again at the same moment.

**Current behavior:** `verifyRefreshToken` (`src/utils/tokens.js`) verifies only against `env.jwt.refreshSecret`. There is no fallback secret today, so a rotation is a hard cutover for admin sessions.

**Recommended grace-period pattern** (small, low-risk change if you want to implement it before launch):

```js
// env.js
refreshSecret: process.env.JWT_REFRESH_SECRET,
previousRefreshSecret: process.env.JWT_REFRESH_SECRET_PREVIOUS || null,

// tokens.js
export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, env.jwt.refreshSecret);
  } catch (err) {
    if (env.jwt.previousRefreshSecret) {
      return jwt.verify(token, env.jwt.previousRefreshSecret); // still honored during the grace window
    }
    throw err;
  }
}
```

Rotation procedure with this in place:
1. Set `JWT_REFRESH_SECRET_PREVIOUS` = the current (soon-to-be-old) `JWT_REFRESH_SECRET` value.
2. Set `JWT_REFRESH_SECRET` = a freshly generated value (e.g. `openssl rand -hex 64`). **Do not** generate/print/commit this value from an AI assistant session — generate it yourself, out of band.
3. Deploy. Existing admin sessions keep refreshing (old tokens verify against `previousRefreshSecret`); every *new* login mints tokens signed with the new secret.
4. After `JWT_REFRESH_EXPIRES_IN` (default 7 days) has fully elapsed since step 2, remove `JWT_REFRESH_SECRET_PREVIOUS` entirely. Any token that could only verify against the old secret has expired by then anyway.

**As shipped in this phase, this fallback is not wired in** — the change above was judged out of scope to land without a dedicated test pass given the time budget, so it's documented here rather than half-implemented. Until it exists, rotating `JWT_REFRESH_SECRET` is a hard cutover: every admin gets logged out and has to log in again. That's an acceptable one-time cost for a *pre-launch* rotation (no real admins depending on live sessions yet); it is not acceptable to do casually post-launch without adding the fallback first.

### Customer sessions — no JWT secret to rotate, but here's how to force a wipe

Customer refresh tokens are opaque + hashed in the DB, not JWTs, so there's nothing to "rotate" cryptographically. If a customer refresh token is suspected to have leaked (e.g. from a log, a support ticket screenshot, etc.), revoke it directly:

```sql
update "CustomerRefreshSession" set "revokedAt" = now() where "revokedAt" is null;
```

(Scope the `where` to one `customerId` for a single-account incident, or leave it unscoped to force every customer to log in again.) Customer *access* tokens still ride on `JWT_ACCESS_SECRET`, so a full customer-session wipe also benefits from rotating that secret per the access-token section above.

### Refresh token reuse detection (added this phase)

`refresh()` in `src/modules/customer-auth/customer-auth.service.js` now treats replay of an already-rotated refresh token as theft: if a refresh token that was already revoked (i.e. already used once to rotate) is presented again, **every** active session for that customer is revoked, not just the one being replayed. This catches the classic "attacker steals a refresh token, victim's client later rotates it normally, attacker's copy is now detected on next use" pattern. Admin refresh tokens are stateless JWTs (no session table), so the equivalent reuse detection is **not** currently possible for admin sessions — this is a known gap; if admin-side reuse detection matters before launch, it requires moving admin refresh tokens to the same DB-session model customer auth already uses.

## Upload validation (added this phase)

Product images, book PDFs, and CMS media uploads now additionally:
- Reject "double extension" filenames (`cover.png.exe`, `book.pdf.php`, etc.) even when the final extension and declared MIME type look fine.
- Verify the actual file bytes (magic-byte / file-signature check) against the claimed type for JPEG/PNG/WebP and PDF — the client-supplied `Content-Type` header and filename extension are both trivially spoofable and are no longer trusted alone.
- Storage filenames/keys are always server-generated (`crypto.randomUUID()`), never derived from the client's original filename — this was already true before this phase and remains the design.

GIF and SVG (accepted by the admin media library only, not the product-image/PDF paths) do not have a reliable single-signature check and are **not** currently magic-byte-verified; SVG in particular can carry inline `<script>`, so treat "SVG upload" as an admin-trust-boundary feature only (it already is — the route requires `requireAdmin`) and do not expose it to non-admin users without adding SVG sanitization (e.g. via DOMPurify server-side, or stripping `<script>`/`on*` attributes) first.

## Private PDF downloads

Unchanged design, verified this phase: the storage key/path for a book's PDF is never returned in any API response (checked `download.service.js`, `bookFormat.*`); the only way to reach the bytes is `GET /api/downloads/:token` with a token that is (a) high-entropy, (b) hashed at rest, (c) checked against order payment status, expiry, and remaining-download-count before the file is streamed. A rate limiter (`downloadLimiter`, 30 req / 15 min) was added this phase to slow down brute-force token guessing / entitlement-counter scraping; it did not exist before.

## Payment endpoint ownership (fixed this phase)

`POST /api/orders/:orderId/payment` and `.../payment/retry` previously took an `orderId` from the URL and performed **no ownership check at all** — any caller who knew (or guessed) an order id could mint/re-mint a live Razorpay checkout session tied to someone else's order (an IDOR). Fixed: if the order is linked to a customer account (`order.customerId` set), the request must now come from that same authenticated customer (`optionalCustomer` middleware + a check in `payment.service.js`) or it 404s. Guest orders (`customerId` null, the normal case right after checkout) are intentionally left as before — checkout itself is guest-accessible and the order id is a high-entropy id handed only to the checkout session — but that means a leaked/logged guest order id is still enough to touch this endpoint. If that residual risk matters, the fix is to also require the order's `accessToken` (the same one used by `/orders/:orderNumber/confirmation` and the download flows) on these two endpoints.

## What was checked and found already solid

- Admin routes: every `admin*.routes.js` file either mounts `requireAdmin` or is legitimately public/customer-scoped (verified against the full route list).
- Customer-scoped resources (addresses, orders, wishlist, reviews, downloads): every query is scoped by `customerId`/ownership, not just "any logged-in customer" (spot-checked `account.routes.js`, `wishlist.service.js`, `review.service.js`, `download.service.js`).
- Webhook signature check (`webhook.controller.js`) runs before any DB write/processing, uses `crypto.timingSafeEqual`, and idempotency via a `WebhookEvent` unique-constraint table is intact.
- No `$queryRawUnsafe`/`$executeRawUnsafe` anywhere in the codebase.
- No server-side `res.redirect` to a client-supplied URL anywhere (no open-redirect surface).
- Cookies (`refreshCookieOptions`): `httpOnly: true`, `secure` in production, `sameSite: "lax"`, scoped `path`. Access tokens are bearer tokens (Authorization header), not cookies, so there's no CSRF surface on them; the refresh cookie's `sameSite: lax` + scoped path is adequate CSRF mitigation for the one cookie-borne credential that exists.
- CMS/review rich text rendering goes through `DOMPurify.sanitize()` before `dangerouslySetInnerHTML` (`src/components/cms/RichTextRenderer.jsx`) — no raw HTML injection path found.

## Known gaps not fixed this phase (documented, not silently left broken)

- **Admin refresh-token reuse detection**: not possible without moving admin sessions off stateless JWTs onto a DB session table (see above).
- **`multer@1.x`**: flagged by `npm audit` as deprecated/vulnerable; upgrading to `multer@2.x` changes its API surface (memory storage error semantics) and was judged too risky to do blind in this pass without a dedicated regression pass on every upload route. Recommend scheduling that upgrade with its own test cycle before launch.
- **Guest payment-endpoint order-id exposure**: see "Payment endpoint ownership" above — mitigated by high-entropy ids, not eliminated.
