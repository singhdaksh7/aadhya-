import { describe, expect, it } from "vitest";
import { settingsValidationSchema, DEFAULT_SETTINGS } from "../src/modules/settings/settings.routes.js";

// The "Made with ❤️ by Team Digital Clik" credit is fixed in the storefront code, so the settings API must not carry it.
describe("footer developer credit is not a store setting", () => {
  it("has no default credit setting", () => {
    expect(DEFAULT_SETTINGS.footer.credit).toBeUndefined();
  });

  it("drops any credit sent to the settings API instead of storing it", () => {
    const out = settingsValidationSchema.safeParse({ footer: { brandDescription: "x", credit: { enabled: false, name: "Someone Else" } } });
    expect(out.success).toBe(true);
    expect(out.data.footer.credit).toBeUndefined();
    expect(out.data.footer.brandDescription).toBe("x");
  });
});
