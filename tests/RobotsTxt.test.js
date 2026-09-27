import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("public/robots.txt", () => {
  const content = fs.readFileSync(path.resolve(process.cwd(), "public/robots.txt"), "utf8");

  it("disallows admin, account, and api paths", () => {
    expect(content).toMatch(/Disallow:\s*\/admin/);
    expect(content).toMatch(/Disallow:\s*\/account/);
    expect(content).toMatch(/Disallow:\s*\/api\//);
  });

  it("references the sitemap", () => {
    expect(content).toMatch(/Sitemap:\s*\/sitemap\.xml/);
  });
});
