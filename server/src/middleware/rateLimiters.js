import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

// Rate limiters share an in-memory counter keyed by IP for the lifetime of
// the process. That's correct in production, but in the test suite every
// request comes from the same loopback IP within one process, so a single
// test file exercising more than `limit` auth/checkout requests would trip
// these for reasons that have nothing to do with the behavior under test.
// Skipping them under NODE_ENV=test keeps limiter *logic* itself testable
// (it's just express-rate-limit, not this app's code) while letting the
// rest of the suite exercise auth/checkout endpoints as many times as needed.
const skipInTest = () => env.isTest || process.env.DISABLE_RATE_LIMIT === "true";

// The global /api limiter is split into independent buckets (each IP has a separate counter per
// bucket) so that ordinary browsing and admin work cannot exhaust the budget meant for sensitive
// writes. A storefront page load alone issues ~10-15 read requests, and several people (e.g. a client
// and their team in one office) can share a single IP, so reads and the chatty admin UI get a much
// larger allowance. Login, refresh, checkout, track-order etc. keep their own stricter per-route
// limiters below, and the Razorpay/shipping webhooks are mounted before any limiter.
const WINDOW_MS = 15 * 60 * 1000;
export const isAdminApiRequest = (req) => req.path === "/admin" || req.path.startsWith("/admin/");
export const isPublicReadRequest = (req) => (req.method === "GET" || req.method === "HEAD") && !isAdminApiRequest(req);

// Public GET/HEAD (catalog, settings, pages, search, ...).
export const publicReadLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 3000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => skipInTest() || !isPublicReadRequest(req),
});

// Authenticated admin API (the admin UI is chatty; /admin/auth/login keeps its own strict limiter).
export const adminApiLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 3000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => skipInTest() || !isAdminApiRequest(req),
});

// Everything else: public writes (cart, account, newsletter, analytics, orders...).
export const apiLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => skipInTest() || isAdminApiRequest(req) || isPublicReadRequest(req),
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: "Too many login attempts. Try again later." } },
  skip: skipInTest,
});

export const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many account creation attempts. Please try again shortly." } },
  skip: skipInTest,
});

export const newsletterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many subscription requests. Please try again later." } },
  skip: skipInTest,
});

export const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: "Too many checkout attempts. Try again later." } },
  skip: skipInTest,
});

// Order lookup is a guessing-attack surface (order number + email) — keep it tight.
export const trackOrderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: "Too many lookup attempts. Try again later." } },
  skip: skipInTest,
});

// Public event-tracking sink — generous enough for real browsing sessions,
// tight enough that it can't be used as a free-form write firehose.
export const analyticsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many analytics events. Try again later." } },
  skip: skipInTest,
});

// Token-refresh endpoint doesn't take a password but is still a credential
// exchange worth throttling against brute-force/enumeration attempts.
// The storefront restores the customer session with a refresh call on every full page load (even for
// anonymous visitors, which just get a cheap 401), so a normal browsing session - or several people
// behind one office IP - easily exceeds a few dozen. The refresh token is a high-entropy httpOnly cookie
// that is rotated on use, so guessing it is not feasible; this limit only needs to stop floods.
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: "Too many session refresh attempts. Try again later." } },
  skip: skipInTest,
});

// Download token endpoint: the token itself is the credential (192-bit,
// hashed at rest), but still worth throttling to slow down brute-force
// guessing / automated scraping of entitlement counters.
export const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: "Too many download attempts. Try again later." } },
  skip: skipInTest,
});

export const reviewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: "Too many review submissions. Try again later." } },
  skip: skipInTest,
});

