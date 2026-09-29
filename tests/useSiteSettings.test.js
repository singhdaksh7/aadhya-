import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const fetchSiteSettings = vi.fn();
vi.mock("../src/lib/api", () => ({
  fetchSiteSettings: (...args) => fetchSiteSettings(...args),
}));

describe("useSiteSettings", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchSiteSettings.mockReset();
  });

  it("fetches settings once and merges them over the defaults", async () => {
    fetchSiteSettings.mockResolvedValue({
      data: { branding: { desktopLogo: "/uploads/products/logo.png" } },
    });
    const { useSiteSettings } = await import("../src/hooks/useSiteSettings");
    const { result } = renderHook(() => useSiteSettings());

    await waitFor(() => {
      expect(result.current.branding.desktopLogo).toBe("/uploads/products/logo.png");
    });
    // Defaults not touched by the response should still be present.
    expect(result.current.general.storeName).toBe("Aadya");
  });

  it("refreshSiteSettings() pushes fresh data to already-mounted subscribers without a page reload", async () => {
    fetchSiteSettings.mockResolvedValueOnce({ data: { branding: { desktopLogo: "/uploads/products/old.png" } } });
    const { useSiteSettings, refreshSiteSettings } = await import("../src/hooks/useSiteSettings");
    const { result } = renderHook(() => useSiteSettings());

    await waitFor(() => {
      expect(result.current.branding.desktopLogo).toBe("/uploads/products/old.png");
    });

    fetchSiteSettings.mockResolvedValueOnce({ data: { branding: { desktopLogo: "/uploads/products/new.png" } } });
    await act(async () => {
      await refreshSiteSettings();
    });

    expect(result.current.branding.desktopLogo).toBe("/uploads/products/new.png");
  });
});
