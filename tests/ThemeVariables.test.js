import { describe, it, expect, beforeEach, vi } from "vitest";
import { applyThemeVariables, DEFAULT_THEME_COLORS } from "../src/hooks/useSiteSettings";
import { getContrastColor } from "../src/lib/color";

function getVar(name) {
  return document.documentElement.style.getPropertyValue(name);
}

describe("applyThemeVariables", () => {
  beforeEach(() => {
    // Clear any variables set by a previous test.
    document.documentElement.removeAttribute("style");
  });

  it("sets all theme CSS variables from full appearance settings", () => {
    applyThemeVariables({
      colors: {
        primary: "#123456",
        secondary: "#654321",
        background: "#FFFFFF",
        surface: "#EEEEEE",
        text: "#111111",
        mutedText: "#888888",
        border: "#CCCCCC",
        accent: "#00FF00",
      },
    });

    expect(getVar("--theme-primary")).toBe("#123456");
    expect(getVar("--theme-secondary")).toBe("#654321");
    expect(getVar("--theme-background")).toBe("#FFFFFF");
    expect(getVar("--theme-surface")).toBe("#EEEEEE");
    expect(getVar("--theme-text")).toBe("#111111");
    expect(getVar("--theme-muted")).toBe("#888888");
    expect(getVar("--theme-border")).toBe("#CCCCCC");
    expect(getVar("--theme-accent")).toBe("#00FF00");
    expect(getVar("--theme-primary-hover")).toMatch(/^#[0-9A-F]{6}$/);
    expect(getVar("--theme-primary-soft")).toMatch(/^#[0-9A-F]{6}$/);
    expect(getVar("--theme-secondary-soft")).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("uses Aadya defaults when settings are empty", () => {
    applyThemeVariables({ colors: {} });

    expect(getVar("--theme-primary")).toBe(DEFAULT_THEME_COLORS.primary);
    expect(getVar("--theme-secondary")).toBe(DEFAULT_THEME_COLORS.secondary);
    expect(getVar("--theme-background")).toBe(DEFAULT_THEME_COLORS.background);
    expect(getVar("--theme-text")).toBe(DEFAULT_THEME_COLORS.text);
    expect(getVar("--theme-accent")).toBe(DEFAULT_THEME_COLORS.accent);
    expect(getVar("--theme-surface")).toBe(DEFAULT_THEME_COLORS.surface);
    expect(getVar("--theme-muted")).toBe(DEFAULT_THEME_COLORS.muted);
    expect(getVar("--theme-border")).toBe(DEFAULT_THEME_COLORS.border);
  });

  it("also handles undefined/missing appearance without throwing, applying defaults", () => {
    expect(() => applyThemeVariables(undefined)).not.toThrow();
    expect(getVar("--theme-primary")).toBe(DEFAULT_THEME_COLORS.primary);
  });

  it("derives accent/surface/muted/border when only primary/secondary/background/text are set", () => {
    applyThemeVariables({
      colors: {
        primary: "#B8674A",
        secondary: "#8A9A82",
        background: "#FFFFFF",
        text: "#2B2723",
      },
    });

    // Derived values should not equal the raw inputs and should be valid hex colors.
    expect(getVar("--theme-accent")).toMatch(/^#[0-9A-F]{6}$/);
    expect(getVar("--theme-surface")).toMatch(/^#[0-9A-F]{6}$/);
    expect(getVar("--theme-muted")).toMatch(/^#[0-9A-F]{6}$/);
    expect(getVar("--theme-border")).toMatch(/^#[0-9A-F]{6}$/);
    expect(getVar("--theme-primary")).toBe("#B8674A");
    expect(getVar("--theme-secondary")).toBe("#8A9A82");
  });

  it("resets to defaults when reapplied with empty settings (reset-to-Aadya-defaults behavior)", () => {
    applyThemeVariables({ colors: { primary: "#FF0000", secondary: "#00FF00" } });
    expect(getVar("--theme-primary")).toBe("#FF0000");

    applyThemeVariables({ colors: { ...DEFAULT_THEME_COLORS } });
    expect(getVar("--theme-primary")).toBe(DEFAULT_THEME_COLORS.primary);
    expect(getVar("--theme-secondary")).toBe(DEFAULT_THEME_COLORS.secondary);
    expect(getVar("--theme-background")).toBe(DEFAULT_THEME_COLORS.background);
    expect(getVar("--theme-text")).toBe(DEFAULT_THEME_COLORS.text);
  });
});

describe("getContrastColor", () => {
  it("picks white text for a dark primary color", () => {
    expect(getContrastColor("#0057FF")).toBe("#FFFFFF");
    expect(getContrastColor("#000000")).toBe("#FFFFFF");
  });

  it("picks dark text for a light primary color", () => {
    expect(getContrastColor("#FFCC00")).toBe("#111111");
    expect(getContrastColor("#FFC0CB")).toBe("#111111"); // light pink
  });
});

describe("storefront/admin theme scoping", () => {
  async function readProjectFile(relativePath) {
    const path = await import("node:path");
    const fs = await import("node:fs/promises");
    return fs.readFile(path.resolve(process.cwd(), relativePath), "utf8");
  }

  it("SiteLayout's root carries the .storefront-theme scope class, not a hardcoded bg/text pair that could fight it", async () => {
    const appSource = await readProjectFile("src/App.jsx");
    const siteLayoutMatch = appSource.match(/function SiteLayout[\s\S]*?<div className="([^"]*)"/);
    expect(siteLayoutMatch).toBeTruthy();
    const rootClassName = siteLayoutMatch[1];
    expect(rootClassName).toMatch(/\bstorefront-theme\b/);
    expect(rootClassName).not.toMatch(/\bbg-white\b/);
    expect(rootClassName).not.toMatch(/\btext-charcoal\b/);
  });

  it("the admin shell is never rendered inside .storefront-theme (admin does not inherit the storefront theme)", async () => {
    const appSource = await readProjectFile("src/App.jsx");
    const adminLayoutSource = await readProjectFile("src/components/admin/AdminLayout.jsx");
    // AdminLayout is mounted on its own route branch in App.jsx, never nested
    // under SiteLayout's <div className="storefront-theme ...">.
    const siteLayoutBody = appSource.slice(
      appSource.indexOf("function SiteLayout"),
      appSource.indexOf("function SiteLayout") + 2000
    );
    expect(siteLayoutBody).not.toMatch(/AdminLayout/);
    // And AdminLayout defines its own independent scope, not storefront-theme.
    expect(adminLayoutSource).toMatch(/admin-shell/);
    expect(adminLayoutSource).not.toMatch(/storefront-theme/);
  });

  it("customer account routes are nested inside SiteLayout, so they inherit the storefront theme", async () => {
    const appSource = await readProjectFile("src/App.jsx");
    const siteLayoutStart = appSource.indexOf("function SiteLayout");
    const siteLayoutBody = appSource.slice(siteLayoutStart, siteLayoutStart + 6000);
    expect(siteLayoutBody).toMatch(/path="\/account"/);
    expect(siteLayoutBody).toMatch(/path="\/account\/orders"/);
  });
});

describe("live refresh", () => {
  it("refreshSiteSettings() re-applies theme variables when new appearance settings are fetched", async () => {
    vi.resetModules();
    vi.doMock("../src/lib/api", () => ({
      fetchSiteSettings: vi
        .fn()
        .mockResolvedValueOnce({ data: { appearance: { colors: { primary: "#0057FF" } } } })
        .mockResolvedValueOnce({ data: { appearance: { colors: { primary: "#FFCC00" } } } }),
    }));
    const mod = await import("../src/hooks/useSiteSettings.js");
    document.documentElement.removeAttribute("style");

    await mod.refreshSiteSettings();
    expect(document.documentElement.style.getPropertyValue("--theme-primary")).toBe("#0057FF");

    await mod.refreshSiteSettings();
    expect(document.documentElement.style.getPropertyValue("--theme-primary")).toBe("#FFCC00");

    vi.doUnmock("../src/lib/api");
    vi.resetModules();
  });
});
