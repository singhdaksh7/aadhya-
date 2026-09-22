# Aadya backend API

Base URL: `/api`. All successful responses use `{ "success": true, "data": …, "meta": …? }`; errors use `{ "success": false, "error": { "message": … } }`.

## Public storefront

- `GET /health`
- `GET /products?page=&limit=&search=&category=&productType=&featured=&sort=`
- `GET /products/:slug`, `GET /products/:slug/related`, `GET /books`
- `GET /categories`, `GET /categories/:slug/products`
- `GET /collections`, `GET /collections/:slug`
- `GET /settings`
- `POST /newsletter/subscribe` — `{ email }`

## Customer

- `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`
- `POST /auth/forgot-password`, `/auth/reset-password`; `GET /auth/me`
- `GET|PATCH /account/profile`; `POST /account/change-password`
- `GET|POST /account/addresses`, `PATCH|DELETE /account/addresses/:id`
- `GET /account/orders`, `GET /account/orders/:id`
- `GET /cart`; `POST /cart/items`; `PATCH|DELETE /cart/items/:productId`; `DELETE /cart`; `POST /cart/merge`
- `POST /checkout/preview`, `POST /orders`, `POST /orders/track`
- `POST /payments/razorpay/verify`; `POST /webhooks/razorpay`

Customer endpoints require an `Authorization: Bearer <customer access token>` header where applicable. Refresh tokens are HTTP-only cookies. Never send a client-calculated total to checkout: the server calculates it from current products.

## Admin

All admin routes require an admin-audience JWT.

- `POST /admin/auth/login`, `/admin/auth/refresh`, `/admin/auth/logout`
- `GET /admin/dashboard`
- `GET|POST /admin/products`; `GET|PATCH|DELETE /admin/products/:id`; `POST /admin/products/:id/images`; `PUT /admin/products/:id/images/reorder`
- `GET|POST /admin/categories`; `GET|PATCH|DELETE /admin/categories/:id`
- `GET|POST /admin/collections`; `GET|PATCH|DELETE /admin/collections/:id`; `PUT /admin/collections/:id/products` with `{ productIds: string[] }`
- `GET|PUT /admin/settings` — only the documented, allow-listed commerce and presentation keys are accepted.
- `GET /admin/orders`, `GET /admin/orders/:id`, `PATCH /admin/orders/:id/status`

Payment status cannot be set to `PAID` by admin order-status endpoints. Razorpay server verification/webhooks are the payment authority.
# Backend additions: variants, merchandising, and operations

All responses use `{ success, data, meta? }`; errors use `{ success:false, error:{ message, details? } }`. Admin endpoints require `Authorization: Bearer <admin access token>`; customer tokens are rejected. Paginated lists use `meta: { page, limit, total, totalPages }`.

## Products and variants

`GET /api/products` accepts `search`, `category`, `collection`, `productType`, `minPrice`, `maxPrice`, `featured`, `bestSeller`, `newArrival`, `availability=in_stock|out_of_stock`, `sort=newest|price_asc|price_desc|name_asc`, `page`, and `limit`. `GET /api/products/:slug` includes active variants only: `{ id, name, sku, attributes, price, stockQuantity, available }`; `price` is server-derived from `priceOverride`, sale price, then base price.

Admin variant CRUD is `GET|POST /api/admin/products/:id/variants`, `PATCH|DELETE /api/admin/products/:id/variants/:variantId`. Create payload: `{ name, sku, priceOverride?: number|null, stockQuantity, isActive?, attributes?: object|null }`. A variant always belongs to the URL product; SKU conflicts return 409.

Cart/checkout line payloads are `{ slug, variantId?: uuid|null, quantity }`. Prices supplied by the browser are ignored. Variant products require an active in-stock variant; checkout returns validation errors for an inactive, mismatched, or unavailable selection. Paid order items retain `variantId`, name/SKU/attributes/authoritative price snapshots.

## Collections, settings, newsletter

Public: `GET /api/collections`, `GET /api/collections/:slug`, and `GET /api/settings`. Only active collections/products are publicly exposed. Admin collections: `GET|POST /api/admin/collections`, `GET|PATCH|DELETE /api/admin/collections/:id`, `PUT /api/admin/collections/:id/products` with `{ productIds: [uuid] }` in display order.

Admin settings: `GET|PUT /api/admin/settings`. The PUT allow-list is `announcementBar`, `supportPhone`, `supportEmail`, `standardShippingAmount`, `freeShippingThreshold`, `socialLinks`, `homepageHero`, `seoDefaults`; other keys (including secrets) are rejected. `POST /api/newsletter/subscribe` accepts `{ email }`, normalizes it, and always returns the safe `{ subscribed:true }` response for a valid address.

## Operations admin APIs

`GET /api/admin/customers?page&limit&search` searches name/email/phone and returns `id,name,email,phone,isActive,createdAt,ordersCount,totalSpent`. `GET /api/admin/customers/:id` returns profile, addresses, recent orders, total spend, and status without credentials. `PATCH /api/admin/customers/:id/status` accepts `{ isActive }`; deactivation revokes customer refresh sessions.

SUPER_ADMIN-only admin-user endpoints: `GET|POST /api/admin/admin-users`, `PATCH /api/admin/admin-users/:id`, and `PATCH /api/admin/admin-users/:id/status`. Create accepts `{ name,email,password,role }`; patch accepts those fields plus `isActive`. Password hashes never appear in responses; the last active SUPER_ADMIN cannot be deactivated or demoted.

## Storage

Uploads use `STORAGE_DRIVER=local|s3`. Local remains the default. S3-compatible mode requires `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, plus `S3_ENDPOINT` for compatible providers and optional `S3_PUBLIC_BASE_URL` for CDN/public URLs. Product code depends only on the storage `save(buffer,mime)` and `remove(url)` abstraction.
