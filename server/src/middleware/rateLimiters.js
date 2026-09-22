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
const skipInTest = () => env.isTest;

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: "Too many login attempts. Try again later." } },
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
