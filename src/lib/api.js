import { getStoredUtmAttribution } from "./attribution";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

// Product images come back as absolute URLs (seed data) or as server-relative
// upload paths like "/uploads/products/xyz.png" — resolve the latter against
// the API origin so <img> tags work regardless of which one it is.
export function resolveProductImageUrl(url) {
  if (!url) return null;
  return /^https?:\/\//.test(url) ? url : `${API_ORIGIN}${url}`;
}

// Single canonical media URL normalizer, reused everywhere an admin-uploaded
// asset (logo, favicon, banner, category image, etc.) needs to be rendered.
// Handles: a full https URL (S3/CDN/public storage — returned unchanged), a
// server-relative "/uploads/..." path (resolved against the API origin), and
// a falsy/empty value (returns null so callers can fall back cleanly). Never
// double-prepends the API origin because the absolute-URL check runs first.
export const resolveMediaUrl = resolveProductImageUrl;

export class ApiRequestError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Admin and customer are separate JWT audiences on the backend and must never
// share a token slot — a failed admin-refresh probe (e.g. on a public page)
// setting a null token must not be able to clobber a logged-in customer's
// token, and vice versa.
const tokens = { customer: null, admin: null };
export function setAccessToken(token, kind = "customer") {
  tokens[kind] = token;
}
export function getAccessToken(kind = "customer") {
  return tokens[kind];
}

async function request(path, { method = "GET", body, headers, isForm = false, auth = false } = {}) {
  const tokenKind = auth === true ? "customer" : auth || null;
  const token = tokenKind ? tokens[tokenKind] : null;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: "include",
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    // No JSON body (e.g. 204 No Content) — leave payload null.
  }

  if (!res.ok) {
    throw new ApiRequestError(
      payload?.error?.message || `Request failed with status ${res.status}`,
      res.status,
      payload?.error?.details
    );
  }

  return payload;
}

// IMPORTANT: this client must never silently substitute fabricated data for
// a failed request (no ".catch(() => fakeProduct)" etc). A failed request
// has to surface as a real error/empty state — swallowing it into fake
// "success" would hide real backend problems and defeat the security checks
// that expect a rejected/forged request to actually be rejected.
export const api = {
  get: (path, opts) => request(path, { ...opts, method: "GET" }),
  post: (path, body, opts) => request(path, { ...opts, method: "POST", body }),
  patch: (path, body, opts) => request(path, { ...opts, method: "PATCH", body }),
  put: (path, body, opts) => request(path, { ...opts, method: "PUT", body }),
  delete: (path, opts) => request(path, { ...opts, method: "DELETE" }),
};

// The backend returns the authoritative product shape: nested `category`
// object, `images` as an array of {url,...} records, and merchandising
// flags named after the Prisma schema (isNewArrival, not isNew). The
// storefront display components (ProductCard, ProductDetail, CartPage,
// SearchModal) were built against a flatter shape — flat image URL
// strings, a plain category name + categorySlug, `isNew`/`inStock`. This
// normalizes every public-facing product response ONCE, at the network
// boundary, so every consumer (browse pages, PDP, guest cart resolution,
// and the server cart response for logged-in users) sees the same shape
// regardless of entry point. Admin functions intentionally do NOT use
// this — the admin product form needs the raw categoryId/bookDetail shape.
export function normalizeProduct(p) {
  if (!p) return p;
  const images = (p.images || [])
    .slice()
    .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((img) => resolveProductImageUrl(img.url))
    .filter(Boolean);
  return {
    ...p,
    price: p.price != null ? Number(p.price) : p.price,
    salePrice: p.salePrice != null ? Number(p.salePrice) : null,
    category: p.category?.name ?? p.category ?? null,
    categorySlug: p.category?.slug ?? p.categorySlug ?? null,
    images,
    image: images[0],
    inStock: p.trackInventory ? p.stockQuantity > 0 : true,
    isNew: p.isNewArrival ?? p.isNew ?? false,
    isBestSeller: p.isBestSeller ?? false,
    author: p.bookDetail?.author ?? undefined,
    isbn: p.bookDetail?.isbn ?? undefined,
    publisher: p.bookDetail?.publisher ?? undefined,
    language: p.bookDetail?.language ?? undefined,
    pageCount: p.bookDetail?.pageCount ?? undefined,
    pages: p.bookDetail?.pageCount ?? undefined,
    edition: p.bookDetail?.edition ?? undefined,
    publicationYear: p.bookDetail?.publicationYear ?? undefined,
    story: p.description ?? undefined,
    relatedProducts: p.relatedProducts ? p.relatedProducts.map(normalizeProduct) : p.relatedProducts,
  };
}

function normalizeCartLine(line) {
  return { ...line, product: normalizeProduct(line.product) };
}

async function normalizedCart(promise) {
  const res = await promise;
  return { ...res, data: (res.data || []).map(normalizeCartLine) };
}

// --- Public storefront ---
export async function fetchProducts(params = {}) {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== null))
  ).toString();
  const res = await api.get(`/products${query ? `?${query}` : ""}`);
  return { ...res, data: (res.data || []).map(normalizeProduct) };
}

export async function fetchProductBySlug(slug) {
  const res = await api.get(`/products/${slug}`);
  return { ...res, data: normalizeProduct(res.data) };
}

export async function fetchCategories() {
  const res = await api.get("/categories");
  return { ...res, data: (res.data || []).map((c) => ({ ...c, itemCount: c._count?.products ?? 0 })) };
}

export function fetchCollections() {
  return api.get("/collections");
}

export function fetchCollectionBySlug(slug) {
  return api.get(`/collections/${slug}`);
}

// --- Admin ---
export function adminLogin(email, password) {
  return api.post("/admin/auth/login", { email, password });
}

export function adminRefresh() {
  return api.post("/admin/auth/refresh");
}

export function adminLogout() {
  return api.post("/admin/auth/logout");
}

export function adminMe() {
  return api.get("/admin/auth/me", { auth: "admin" });
}

export function adminDashboard() {
  return api.get("/admin/dashboard", { auth: "admin" });
}

export function adminListProducts(params = {}) {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== null))
  ).toString();
  return api.get(`/admin/products${query ? `?${query}` : ""}`, { auth: "admin" });
}

export function adminGetProduct(id) {
  return api.get(`/admin/products/${id}`, { auth: "admin" });
}

export function adminCreateProduct(data) {
  return api.post("/admin/products", data, { auth: "admin" });
}

export function adminUpdateProduct(id, data) {
  return api.patch(`/admin/products/${id}`, data, { auth: "admin" });
}

export function adminDeleteProduct(id) {
  return api.delete(`/admin/products/${id}`, { auth: "admin" });
}

export function adminUploadProductImage(productId, file, { altText, isPrimary } = {}) {
  const form = new FormData();
  form.append("image", file);
  if (altText) form.append("altText", altText);
  if (isPrimary) form.append("isPrimary", "true");
  return request(`/admin/products/${productId}/images`, {
    method: "POST",
    body: form,
    isForm: true,
    auth: "admin",
  });
}

export function adminDeleteProductImage(productId, imageId) {
  return api.delete(`/admin/products/${productId}/images/${imageId}`, { auth: "admin" });
}

export function adminSetPrimaryImage(productId, imageId) {
  return api.post(`/admin/products/${productId}/images/${imageId}/primary`, undefined, { auth: "admin" });
}

export function adminReorderImages(productId, order) {
  return api.post(`/admin/products/${productId}/images/reorder`, { order }, { auth: "admin" });
}

// --- Book formats (PHYSICAL / PDF fulfilment for BOOK products) ---
export function fetchBookFormats(productId) {
  return api.get(`/products/${productId}/book-formats`);
}
export function adminListBookFormats(productId) {
  return api.get(`/admin/products/${productId}/book-formats`, { auth: "admin" });
}
export function adminUpsertBookFormat(productId, format, data) {
  return api.put(`/admin/products/${productId}/book-formats/${format}`, data, { auth: "admin" });
}
export function adminDeleteBookFormat(productId, format) {
  return api.delete(`/admin/products/${productId}/book-formats/${format}`, { auth: "admin" });
}
export function adminUploadBookFormatPdf(productId, file) {
  const form = new FormData();
  form.append("pdf", file);
  return request(`/admin/products/${productId}/book-formats/pdf`, { method: "POST", body: form, isForm: true, auth: "admin" });
}
export function adminRemoveBookFormatPdf(productId) {
  return api.delete(`/admin/products/${productId}/book-formats/pdf`, { auth: "admin" });
}

// --- Digital downloads ---
export function accountDownloads() { return api.get("/account/downloads", { auth: true }); }
export function reissueAccountDownloadLink(orderItemId) { return api.post(`/account/downloads/${orderItemId}/link`, undefined, { auth: true }); }
export function guestOrderDownloads(orderNumber, accessToken) { return api.post("/orders/downloads", { orderNumber, accessToken }); }
export function reissueGuestDownloadLink(orderItemId, orderNumber, accessToken) {
  return api.post(`/orders/downloads/${orderItemId}/link`, { orderNumber, accessToken });
}

export function adminListCategories(includeInactive = true) {
  return api.get(`/admin/categories?includeInactive=${includeInactive}`, { auth: "admin" });
}

export function adminCreateCategory(data) {
  return api.post("/admin/categories", data, { auth: "admin" });
}

export function adminUpdateCategory(id, data) {
  return api.patch(`/admin/categories/${id}`, data, { auth: "admin" });
}

export function adminDeleteCategory(id) {
  return api.delete(`/admin/categories/${id}`, { auth: "admin" });
}

export function adminListCollections() {
  return api.get("/admin/collections", { auth: "admin" });
}

export function adminCreateCollection(data) {
  return api.post("/admin/collections", data, { auth: "admin" });
}

export function adminUpdateCollection(id, data) {
  return api.patch(`/admin/collections/${id}`, data, { auth: "admin" });
}

export function adminSetCollectionProducts(id, productIds) {
  return api.put(`/admin/collections/${id}/products`, { productIds }, { auth: "admin" });
}

export function adminDeleteCollection(id) {
  return api.delete(`/admin/collections/${id}`, { auth: "admin" });
}

export function adminListCoupons() {
  return api.get("/admin/coupons", { auth: "admin" });
}

export function adminGetCoupon(id) {
  return api.get(`/admin/coupons/${id}`, { auth: "admin" });
}

export function adminCreateCoupon(data) {
  return api.post("/admin/coupons", data, { auth: "admin" });
}

export function adminUpdateCoupon(id, data) {
  return api.patch(`/admin/coupons/${id}`, data, { auth: "admin" });
}

export function adminDeleteCoupon(id) {
  return api.delete(`/admin/coupons/${id}`, { auth: "admin" });
}

export function validateCouponCode(code, items) {
  return api.post("/coupons/validate", { code, items });
}

export function listPublicActiveCoupons() {
  return api.get("/coupons/active");
}

// --- Checkout / orders / payments ---
export function checkoutPreview(payload) {
  const data = Array.isArray(payload) ? { items: payload } : payload;
  return api.post("/checkout/preview", data);
}

export function createOrder(payload, authenticated = false) {
  // Snapshot whatever UTM attribution was captured at landing time onto the
  // order — this is the one place a completed order gets that attribution,
  // regardless of which checkout UI called createOrder.
  const utm = getStoredUtmAttribution();
  return api.post("/orders", { ...utm, ...payload }, { auth: authenticated ? "customer" : false });
}

export function createRazorpayOrder(orderId) {
  return api.post(`/orders/${orderId}/payment`);
}

export function verifyRazorpayPayment(payload) {
  return api.post("/payments/razorpay/verify", payload);
}

export function fetchOrderConfirmation(orderNumber, token) {
  return api.get(`/orders/${orderNumber}/confirmation?token=${encodeURIComponent(token)}`);
}

export function trackOrder(payload) {
  return api.post("/orders/track", payload);
}

export function adminListOrders(params = {}) {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== null))
  ).toString();
  return api.get(`/admin/orders${query ? `?${query}` : ""}`, { auth: "admin" });
}

export function adminGetOrder(id) {
  return api.get(`/admin/orders/${id}`, { auth: "admin" });
}

export function adminUpdateOrderStatus(id, status, note) {
  return api.patch(`/admin/orders/${id}/status`, { status, note }, { auth: "admin" });
}

export function adminUpsertShipment(id, payload) {
  return api.put(`/admin/orders/${id}/shipment`, payload, { auth: "admin" });
}
export function adminCreateShipment(id, payload) { return api.post(`/admin/orders/${id}/shipment/create`, payload, { auth: "admin" }); }
export function accountInvoices() { return api.get("/account/invoices", { auth: true }); }
export async function downloadAccountInvoice(id) { const res = await fetch(`${API_URL}/account/invoices/${id}/download`, { headers: { Authorization: `Bearer ${tokens.customer}` }, credentials: "include" }); if (!res.ok) throw new ApiRequestError("Could not download invoice", res.status); return res.blob(); }
export function adminGetIntegrationStatus() { return api.get("/admin/integrations", { auth: "admin" }); }
export function adminSaveIntegration(data) { return api.put("/admin/integrations/credentials", data, { auth: "admin" }); }
export function adminTestIntegration(provider, environment) { return api.post(`/admin/integrations/${provider}/${environment}/test`, {}, { auth: "admin" }); }

export function adminGetEmailStatus() { return api.get("/admin/email/status", { auth: "admin" }); }
export function adminSendTestEmail(recipient) { return api.post("/admin/email/test", { recipient }, { auth: "admin" }); }
export function adminGetEmailHealth() { return api.get("/admin/email/health", { auth: "admin" }); }
export function adminGetEmailLogs(params = {}) {
  const query = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ""))).toString();
  return api.get(`/admin/email/logs${query ? `?${query}` : ""}`, { auth: "admin" });
}
export function adminRetryEmailLog(id) { return api.post(`/admin/email/logs/${id}/retry`, {}, { auth: "admin" }); }
export function adminGetShippingBusiness() { return api.get("/admin/shipping/business", { auth: "admin" }); }
export function adminSaveShippingBusiness(data) { return api.put("/admin/shipping/business", data, { auth: "admin" }); }
export function adminGetInvoiceSettings() { return api.get("/admin/invoices/settings", { auth: "admin" }); }
export function adminSaveInvoiceSettings(data) { return api.put("/admin/invoices/settings", data, { auth: "admin" }); }
export function adminListInvoices(params = {}) {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== null))
  ).toString();
  return api.get(`/admin/invoices${query ? `?${query}` : ""}`, { auth: "admin" });
}
export async function adminDownloadInvoice(id) { const res = await fetch(`${API_URL}/admin/invoices/${id}/download`, { headers: { Authorization: `Bearer ${tokens.admin}` }, credentials: "include" }); if (!res.ok) throw new ApiRequestError("Could not download invoice", res.status); return res.blob(); }
export function adminRegenerateInvoice(id) { return api.post(`/admin/invoices/${id}/regenerate`, {}, { auth: "admin" }); }
export function adminResendInvoice(id) { return api.post(`/admin/invoices/${id}/resend`, {}, { auth: "admin" }); }
export function adminGetInvoiceDetail(id) { return api.get(`/admin/invoices/${id}`, { auth: "admin" }); }

export function adminListCustomers(params = {}) {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== null))
  ).toString();
  return api.get(`/admin/customers${query ? `?${query}` : ""}`, { auth: "admin" });
}
export function adminGetCustomer(id) {
  return api.get(`/admin/customers/${id}`, { auth: "admin" });
}
export function adminUpdateCustomerStatus(id, isActive) {
  return api.patch(`/admin/customers/${id}/status`, { isActive }, { auth: "admin" });
}

// Customer accounts use a separate in-memory access token and httpOnly cookie session.
export function customerRegister(data) { return api.post("/auth/register", data); }
export function customerLogin(data) { return api.post("/auth/login", data); }
export function customerRefresh() { return api.post("/auth/refresh"); }
export function customerLogout() { return api.post("/auth/logout"); }
export function customerMe() { return api.get("/auth/me", { auth: true }); }
export function forgotPassword(email) { return api.post("/auth/forgot-password", { email }); }
export function resetPassword(data) { return api.post("/auth/reset-password", data); }
export function accountProfile() { return api.get("/account/profile", { auth: true }); }
export function updateAccountProfile(data) { return api.patch("/account/profile", data, { auth: true }); }
export function changeAccountPassword(data) { return api.post("/account/change-password", data, { auth: true }); }
export function accountAddresses() { return api.get("/account/addresses", { auth: true }); }
export function createAddress(data) { return api.post("/account/addresses", data, { auth: true }); }
export function updateAddress(id,data) { return api.patch(`/account/addresses/${id}`,data,{auth:true}); }
export function deleteAddress(id) { return api.delete(`/account/addresses/${id}`,{auth:true}); }
export function setDefaultAddress(id) { return api.post(`/account/addresses/${id}/default`,undefined,{auth:true}); }
export function setAddressTypeDefault(id, type) { return api.post(`/account/addresses/${id}/default/${type}`, undefined, { auth: true }); }
export function accountOrders(params={}) { const q=new URLSearchParams(params).toString(); return api.get(`/account/orders${q?`?${q}`:""}`,{auth:true}); }
export function accountOrder(orderNumber) { return api.get(`/account/orders/${orderNumber}`,{auth:true}); }
export function accountReturnEligibility(orderNumber) { return api.get(`/account/returns/eligibility/${orderNumber}`,{auth:true}); }
export function createAccountReturn(data) { return api.post("/account/returns", data, { auth: true }); }
export function accountReturns() { return api.get("/account/returns", { auth: true }); }
export function accountReturn(id) { return api.get(`/account/returns/${id}`, { auth: true }); }
export function claimOrder(data) { return api.post("/account/claim-order",data,{auth:true}); }
export function serverCart() { return normalizedCart(api.get("/cart",{auth:true})); }
export function mergeCart(items) { return normalizedCart(api.post("/cart/merge",{items},{auth:true})); }
export function addServerCartItem(data) { return normalizedCart(api.post("/cart/items",data,{auth:true})); }
export function updateServerCartItem(slug,data) { return normalizedCart(api.patch(`/cart/items/${encodeURIComponent(slug)}`,data,{auth:true})); }
export function removeServerCartItem(slug, data) { return request(`/cart/items/${encodeURIComponent(slug)}`, { method: "DELETE", body: data, auth: true }); }
export function clearServerCart() { return api.delete("/cart",{auth:true}); }

export function fetchSiteSettings() { return api.get("/settings"); }
export function adminFetchSiteSettings() { return api.get("/admin/settings", { auth: "admin" }); }
export function adminUpdateSiteSettings(data) { return api.put("/admin/settings", data, { auth: "admin" }); }
export function adminResetAppearanceSettings() { return api.post("/admin/settings/reset-appearance", undefined, { auth: "admin" }); }
export function subscribeNewsletter(email) { return api.post("/newsletter/subscribe", { email }); }

// --- Phase A-C Navigation, Banners, Promos, Homepage Builder ---
export function fetchNavigation(code = "HEADER_MAIN") { return api.get(`/navigation/${code}`); }
export function adminListMenus() { return api.get("/navigation/admin/menus", { auth: "admin" }); }
export function adminCreateMenu(data) { return api.post("/navigation/admin/menus", data, { auth: "admin" }); }
export function adminUpdateMenu(id, data) { return api.put(`/navigation/admin/menus/${id}`, data, { auth: "admin" }); }
export function adminAddMenuItem(menuId, data) { return api.post(`/navigation/admin/menus/${menuId}/items`, data, { auth: "admin" }); }
export function adminUpdateMenuItem(itemId, data) { return api.put(`/navigation/admin/items/${itemId}`, data, { auth: "admin" }); }
export function adminDeleteMenuItem(itemId) { return api.delete(`/navigation/admin/items/${itemId}`, { auth: "admin" }); }

export function fetchHomepage() { return api.get("/pages/home"); }
export function adminFetchHomepage() { return api.get("/admin/pages/home", { auth: "admin" }); }
export function adminCreatePageSection(data) { return api.post("/admin/pages/home/sections", data, { auth: "admin" }); }
export function adminUpdatePageSection(sectionId, data) { return api.put(`/admin/pages/sections/${sectionId}`, data, { auth: "admin" }); }
export function adminDeletePageSection(sectionId) { return api.delete(`/admin/pages/sections/${sectionId}`, { auth: "admin" }); }
export function adminDuplicatePageSection(sectionId) { return api.post(`/admin/pages/sections/${sectionId}/duplicate`, undefined, { auth: "admin" }); }
export function adminReorderPageSections(sectionIds) { return api.put("/admin/pages/sections/reorder", { sectionIds }, { auth: "admin" }); }
export function adminPublishHomepage() { return api.post("/admin/pages/publish", undefined, { auth: "admin" }); }

export function fetchBanners(params = {}) {
  const query = typeof params === "string" ? `placement=${params}` : new URLSearchParams(params).toString();
  return api.get(`/banners${query ? `?${query}` : ""}`);
}
export function adminListBanners(params = {}) {
  const query = new URLSearchParams(params).toString();
  return api.get(`/admin/banners${query ? `?${query}` : ""}`, { auth: "admin" });
}
export function adminFetchBanners(params = {}) { return adminListBanners(params); }
export function adminCreateBanner(data) { return api.post("/admin/banners", data, { auth: "admin" }); }
export function adminUpdateBanner(id, data) { return api.put(`/admin/banners/${id}`, data, { auth: "admin" }); }
export function adminDeleteBanner(id) { return api.delete(`/admin/banners/${id}`, { auth: "admin" }); }

export function fetchPromos() { return api.get("/promos"); }
export function adminListPromos() { return api.get("/admin/promos", { auth: "admin" }); }
export function adminFetchPromos() { return adminListPromos(); }
export function adminCreatePromo(data) { return api.post("/admin/promos", data, { auth: "admin" }); }
export function adminUpdatePromo(id, data) { return api.put(`/admin/promos/${id}`, data, { auth: "admin" }); }
export function adminDeletePromo(id) { return api.delete(`/admin/promos/${id}`, { auth: "admin" }); }

// --- Phase E CMS Pages ---
export function fetchPageBySlug(slug) { return api.get(`/pages/${slug}`); }
export function adminListPages(params = {}) {
  const query = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== null))).toString();
  return api.get(`/admin/pages${query ? `?${query}` : ""}`, { auth: "admin" });
}
export function adminGetPage(id) { return api.get(`/admin/pages/${id}`, { auth: "admin" }); }
export function adminCreatePage(data) { return api.post("/admin/pages", data, { auth: "admin" }); }
export function adminUpdatePage(id, data) { return api.put(`/admin/pages/${id}`, data, { auth: "admin" }); }
export function adminDeletePage(id) { return api.delete(`/admin/pages/${id}`, { auth: "admin" }); }
export function adminPublishPage(id, status) { return api.post(`/admin/pages/${id}/publish`, { status }, { auth: "admin" }); }

// --- Phase E Blog ---
export function fetchBlogPosts(params = {}) {
  const query = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== null))).toString();
  return api.get(`/blog${query ? `?${query}` : ""}`);
}
export function fetchBlogPostBySlug(slug) { return api.get(`/blog/${slug}`); }
export function adminListBlogPosts(params = {}) {
  const query = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== null))).toString();
  return api.get(`/admin/blog${query ? `?${query}` : ""}`, { auth: "admin" });
}
export function adminGetBlogPost(id) { return api.get(`/admin/blog/${id}`, { auth: "admin" }); }
export function adminCreateBlogPost(data) { return api.post("/admin/blog", data, { auth: "admin" }); }
export function adminUpdateBlogPost(id, data) { return api.put(`/admin/blog/${id}`, data, { auth: "admin" }); }
export function adminDeleteBlogPost(id) { return api.delete(`/admin/blog/${id}`, { auth: "admin" }); }
export function adminPublishBlogPost(id, status) { return api.post(`/admin/blog/${id}/publish`, { status }, { auth: "admin" }); }

// --- Phase E FAQ ---
export function fetchFaqs(params = {}) {
  const query = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== null))).toString();
  return api.get(`/faqs${query ? `?${query}` : ""}`);
}
export function adminListFaqCategories() { return api.get("/admin/faqs/categories", { auth: "admin" }); }
export function adminCreateFaqCategory(data) { return api.post("/admin/faqs/categories", data, { auth: "admin" }); }
export function adminUpdateFaqCategory(id, data) { return api.put(`/admin/faqs/categories/${id}`, data, { auth: "admin" }); }
export function adminDeleteFaqCategory(id) { return api.delete(`/admin/faqs/categories/${id}`, { auth: "admin" }); }
export function adminListFaqItems(params = {}) {
  const query = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== null))).toString();
  return api.get(`/admin/faqs/items${query ? `?${query}` : ""}`, { auth: "admin" });
}
export function adminCreateFaqItem(data) { return api.post("/admin/faqs/items", data, { auth: "admin" }); }
export function adminUpdateFaqItem(id, data) { return api.put(`/admin/faqs/items/${id}`, data, { auth: "admin" }); }
export function adminDeleteFaqItem(id) { return api.delete(`/admin/faqs/items/${id}`, { auth: "admin" }); }

// --- Phase E Media Library ---
export function adminListMedia(params = {}) {
  const query = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== null))).toString();
  return api.get(`/admin/media${query ? `?${query}` : ""}`, { auth: "admin" });
}
export function adminUploadMedia(file, { altText, title } = {}) {
  const form = new FormData();
  form.append("file", file);
  if (altText) form.append("altText", altText);
  if (title) form.append("title", title);
  return request("/admin/media/upload", {
    method: "POST",
    body: form,
    isForm: true,
    auth: "admin",
  });
}
export function adminUpdateMedia(id, data) { return api.patch(`/admin/media/${id}`, data, { auth: "admin" }); }
export function adminDeleteMedia(id, force = false) { return api.delete(`/admin/media/${id}${force ? "?force=true" : ""}`, { auth: "admin" }); }

// --- Phase G Product Reviews & Moderation ---
export function fetchProductReviews(productId, params = {}) {
  const query = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== null))).toString();
  return api.get(`/products/${productId}/reviews${query ? `?${query}` : ""}`);
}
export function submitProductReview(data) {
  return api.post("/account/reviews", data, { auth: "customer" });
}
export function fetchCustomerReviews() {
  return api.get("/account/reviews", { auth: "customer" });
}
export function updateCustomerReview(reviewId, data) {
  return api.put(`/account/reviews/${reviewId}`, data, { auth: "customer" });
}
export function deleteCustomerReview(reviewId) {
  return api.delete(`/account/reviews/${reviewId}`, { auth: "customer" });
}
export function adminListReviews(params = {}) {
  const query = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== null))).toString();
  return api.get(`/admin/reviews${query ? `?${query}` : ""}`, { auth: "admin" });
}
export function adminUpdateReviewStatus(reviewId, status) {
  return api.patch(`/admin/reviews/${reviewId}/status`, { status }, { auth: "admin" });
}
export function adminDeleteReview(reviewId) {
  return api.delete(`/admin/reviews/${reviewId}`, { auth: "admin" });
}

// --- Phase G Wishlist ---
export function fetchWishlist() {
  return api.get("/account/wishlist", { auth: "customer" });
}
export function addToWishlist(productId, variantId = null) {
  return api.post("/account/wishlist", { productId, variantId }, { auth: "customer" });
}
export function removeFromWishlist(idOrProductId) {
  return api.delete(`/account/wishlist/${idOrProductId}`, { auth: "customer" });
}

// --- Phase G Customer Notifications ---
export function fetchCustomerNotifications() {
  return api.get("/account/notifications", { auth: "customer" });
}
export function markNotificationRead(id) {
  return api.patch(`/account/notifications/${id}/read`, {}, { auth: "customer" });
}
export function markAllNotificationsRead() {
  return api.patch("/account/notifications/read-all", {}, { auth: "customer" });
}

// --- Phase I: Search ---
export async function fetchSearch(query, sessionId) {
  const params = new URLSearchParams({ q: query || "" });
  if (sessionId) params.set("sessionId", sessionId);
  const res = await api.get(`/search?${params.toString()}`);
  return { ...res, data: { ...res.data, products: (res.data?.products || []).map(normalizeProduct) } };
}

// --- Phase I: Admin Analytics ---
function rangeQuery(range) {
  const params = new URLSearchParams();
  if (range?.range) params.set("range", range.range);
  if (range?.from) params.set("from", range.from);
  if (range?.to) params.set("to", range.to);
  return params.toString();
}
export function fetchAdminAnalyticsOverview(range) {
  return api.get(`/admin/analytics/overview?${rangeQuery(range)}`, { auth: "admin" });
}
export function fetchAdminAnalyticsSearches(range) {
  return api.get(`/admin/analytics/searches?${rangeQuery(range)}`, { auth: "admin" });
}
export function fetchAdminAbandonedCarts() {
  return api.get("/admin/analytics/abandoned-carts", { auth: "admin" });
}
export function sendAbandonedCartRecoveryEmail(cartId) {
  return api.post(`/admin/analytics/abandoned-carts/${cartId}/recovery-email`, {}, { auth: "admin" });
}

// --- Admin notifications (topbar bell) ---
export function adminListNotifications(params = {}) {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== null))
  ).toString();
  return api.get(`/admin/notifications${query ? `?${query}` : ""}`, { auth: "admin" });
}
export function adminMarkNotificationRead(id) {
  return api.patch(`/admin/notifications/${id}/read`, {}, { auth: "admin" });
}
export function adminMarkAllNotificationsRead() {
  return api.patch("/admin/notifications/read-all", {}, { auth: "admin" });
}

// --- Low stock inventory ---
export function adminGetLowStockOverview() {
  return api.get("/admin/inventory/low-stock", { auth: "admin" });
}
export function adminGetLowStockThreshold() {
  return api.get("/admin/inventory/low-stock/threshold", { auth: "admin" });
}
export function adminSetLowStockThreshold(threshold) {
  return api.put("/admin/inventory/low-stock/threshold", { threshold }, { auth: "admin" });
}
export function adminRunLowStockSweep() {
  return api.post("/admin/inventory/low-stock/sweep", {}, { auth: "admin" });
}
export function adminRestockItem(data) {
  return api.post("/admin/inventory/low-stock/restock", data, { auth: "admin" });
}

// --- Admin returns / refunds / RTO ---
export function adminListReturns(params = {}) {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== null))
  ).toString();
  return api.get(`/admin/returns${query ? `?${query}` : ""}`, { auth: "admin" });
}
export function adminGetReturn(id) {
  return api.get(`/admin/returns/${id}`, { auth: "admin" });
}
export function adminApproveReturn(id, resolution) {
  return api.post(`/admin/returns/${id}/approve`, resolution ? { resolution } : undefined, { auth: "admin" });
}
export function adminRejectReturn(id, note) {
  return api.post(`/admin/returns/${id}/reject`, note ? { note } : undefined, { auth: "admin" });
}
export function adminSchedulePickup(id) {
  return api.post(`/admin/returns/${id}/schedule-pickup`, undefined, { auth: "admin" });
}
export function adminMarkReturnInTransit(id) {
  return api.post(`/admin/returns/${id}/in-transit`, undefined, { auth: "admin" });
}
export function adminMarkReturnReceived(id) {
  return api.post(`/admin/returns/${id}/received`, undefined, { auth: "admin" });
}
export function adminIssueReturnRefund(id, data) {
  return api.post(`/admin/returns/${id}/refund`, data, { auth: "admin" });
}
export function adminCloseReturn(id) {
  return api.post(`/admin/returns/${id}/close`, undefined, { auth: "admin" });
}

export { API_URL };
