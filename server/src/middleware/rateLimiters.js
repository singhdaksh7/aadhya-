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

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
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
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
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

