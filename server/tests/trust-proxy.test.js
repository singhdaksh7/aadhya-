import { describe, it, expect, vi, afterEach } from "vitest";

async function loadApp() {
  vi.resetModules();
  const { createApp } = await import("../src/app.js");
  return createApp();
}

describe("trust proxy (rate limiting behind Traefik)", () => {
  const original = { TRUST_PROXY: process.env.TRUST_PROXY, NODE_ENV: process.env.NODE_ENV };
  afterEach(() => {
    for (const [k, v] of Object.entries(original)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("is off by default outside production", async () => {
    delete process.env.TRUST_PROXY;
    const app = await loadApp();
    expect(app.get("trust proxy")).toBeFalsy();
  });

  it("honours an explicit TRUST_PROXY hop count", async () => {
    process.env.TRUST_PROXY = "2";
    const app = await loadApp();
    expect(app.get("trust proxy")).toBe(2);
  });

  it("defaults to one proxy hop in production", async () => {
    delete process.env.TRUST_PROXY;
    process.env.NODE_ENV = "production";
    const app = await loadApp();
    expect(app.get("trust proxy")).toBe(1);
  });
});
