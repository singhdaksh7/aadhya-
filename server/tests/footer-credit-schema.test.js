import { describe, expect, it } from "vitest";
import { settingsValidationSchema, DEFAULT_SETTINGS } from "../src/modules/settings/settings.routes.js";

const parse = (credit) => settingsValidationSchema.safeParse({ footer: { credit } });

describe("footer website credit settings", () => {
  it("ships an editable default credit", () => {
    expect(DEFAULT_SETTINGS.footer.credit).toEqual({ enabled: true, prefix: "Website by", name: "Digital Clik", url: "", logo: "" });
  });

  it("accepts on/off, wording, name, link and logo", () => {
    expect(parse({ enabled: false, prefix: "Crafted by", name: "Studio", url: "https://example.com/x", logo: "/uploads/a.png" }).success).toBe(true);
    expect(parse({ url: "", logo: "" }).success).toBe(true);
    expect(parse({ url: "/about" }).success).toBe(true);
  });

  it("rejects unsafe links/logos and over-long text", () => {
    expect(parse({ url: "javascript:alert(1)" }).success).toBe(false);
    expect(parse({ logo: "data:image/png;base64,AAA" }).success).toBe(false);
    expect(parse({ name: "x".repeat(81) }).success).toBe(false);
    expect(parse({ prefix: "x".repeat(61) }).success).toBe(false);
  });
});
