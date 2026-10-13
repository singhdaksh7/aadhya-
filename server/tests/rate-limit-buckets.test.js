import { describe, it, expect } from "vitest";
import { isAdminApiRequest, isPublicReadRequest } from "../src/middleware/rateLimiters.js";

// DB-free: the global /api limiter is split into public-read, admin and write buckets. `req.path`
// is relative to the /api mount, exactly as Express exposes it inside app.use("/api", ...).
const req = (method, path) => ({ method, path });

describe("rate-limit bucket classification", () => {
  it("treats public GET/HEAD as reads", () => {
    for (const path of ["/settings", "/pages/home", "/products", "/categories", "/search", "/books"]) {
      expect(isPublicReadRequest(req("GET", path))).toBe(true);
      expect(isAdminApiRequest(req("GET", path))).toBe(false);
    }
    expect(isPublicReadRequest(req("HEAD", "/health"))).toBe(true);
  });

  it("treats everything under /admin as the admin bucket, never as a public read", () => {
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
      expect(isAdminApiRequest(req(method, "/admin/products"))).toBe(true);
      expect(isPublicReadRequest(req(method, "/admin/products"))).toBe(false);
    }
    expect(isAdminApiRequest(req("GET", "/admin"))).toBe(true);
    expect(isAdminApiRequest(req("GET", "/administrator-news"))).toBe(false);
  });

  it("leaves public writes in the stricter bucket", () => {
    for (const [method, path] of [["POST", "/orders"], ["POST", "/cart/items"], ["POST", "/newsletter"], ["PUT", "/account/profile"], ["POST", "/analytics/event"]]) {
      expect(isPublicReadRequest(req(method, path))).toBe(false);
      expect(isAdminApiRequest(req(method, path))).toBe(false);
    }
  });
});
