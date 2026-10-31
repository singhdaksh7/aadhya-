import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import PromoPopup, { resetPromoPopupCache } from "../src/components/PromoPopup";
import {
  matchesTargeting,
  isBlockedPath,
  routeMatches,
  popupFrequencyAllows,
  recordPopupSeen,
  shouldShowPopup,
  safePopupHref,
  resetPopupMemory,
} from "../src/lib/promoPopup";
import { fetchPromoPopup } from "../src/lib/api";

vi.mock("../src/lib/api", () => ({
  fetchPromoPopup: vi.fn(),
  resolveProductImageUrl: (u) => u || null,
}));

const base = {
  enabled: true,
  title: "Diwali gifting",
  description: "Handcrafted gifts",
  desktopImage: "https://example.com/d.jpg",
  mobileImage: "https://example.com/m.jpg",
  ctaLabel: "Shop gifts",
  ctaUrl: "/gifting",
  dismissLabel: "Not now",
  delaySeconds: 3,
  frequency: "SESSION",
  days: 7,
  targeting: "HOME",
  routes: [],
  version: 1,
};

const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetPopupMemory();
  resetPromoPopupCache();
  vi.mocked(fetchPromoPopup).mockReset();
});

describe("promo popup targeting", () => {
  it("HOME only matches the homepage", () => {
    expect(matchesTargeting(base, "/")).toBe(true);
    expect(matchesTargeting(base, "/shop")).toBe(false);
  });
  it("ALL matches storefront pages", () => {
    const p = { ...base, targeting: "ALL" };
    expect(matchesTargeting(p, "/shop")).toBe(true);
    expect(matchesTargeting(p, "/gifting/")).toBe(true);
  });
  it("SELECTED matches exact routes and /prefix/* wildcards only", () => {
    const p = { ...base, targeting: "SELECTED", routes: ["/gifting", "/shop/*"] };
    expect(matchesTargeting(p, "/gifting")).toBe(true);
    expect(matchesTargeting(p, "/gifting/")).toBe(true);
    expect(matchesTargeting(p, "/shop")).toBe(true);
    expect(matchesTargeting(p, "/shop/category/x")).toBe(true);
    expect(matchesTargeting(p, "/shopping")).toBe(false);
    expect(matchesTargeting(p, "/about")).toBe(false);
    expect(routeMatches("", "/")).toBe(false);
  });
  it.each(["/admin", "/admin/popup", "/checkout", "/payment/return", "/order/ABC/confirmation", "/cart"])(
    "never targets %s even with ALL",
    (path) => {
      expect(isBlockedPath(path)).toBe(true);
      expect(matchesTargeting({ ...base, targeting: "ALL" }, path)).toBe(false);
      expect(matchesTargeting({ ...base, targeting: "SELECTED", routes: [path] }, path)).toBe(false);
    }
  );
  it("does not block look-alike paths", () => {
    expect(isBlockedPath("/administrator-gifts")).toBe(false);
    expect(isBlockedPath("/ordering")).toBe(false);
  });
});

describe("promo popup frequency and dismissal", () => {
  const t0 = 1_700_000_000_000;

  it("SESSION shows once per session", () => {
    expect(popupFrequencyAllows(base, t0)).toBe(true);
    recordPopupSeen(base, t0);
    expect(popupFrequencyAllows(base, t0 + 5 * DAY)).toBe(false);
    window.sessionStorage.clear();
    resetPopupMemory();
    expect(popupFrequencyAllows(base, t0)).toBe(true);
  });

  it("DAILY waits 24 hours and uses localStorage", () => {
    const p = { ...base, frequency: "DAILY" };
    recordPopupSeen(p, t0);
    expect(window.localStorage.getItem("promoPopup:1")).toContain("lastShownAt");
    expect(popupFrequencyAllows(p, t0 + DAY - 1000)).toBe(false);
    expect(popupFrequencyAllows(p, t0 + DAY)).toBe(true);
  });

  it("EVERY_X_DAYS waits the configured number of days", () => {
    const p = { ...base, frequency: "EVERY_X_DAYS", days: 3 };
    recordPopupSeen(p, t0);
    expect(popupFrequencyAllows(p, t0 + 2 * DAY)).toBe(false);
    expect(popupFrequencyAllows(p, t0 + 3 * DAY)).toBe(true);
  });

  it("a dismissal restarts the interval from the dismissal time", () => {
    const p = { ...base, frequency: "EVERY_X_DAYS", days: 2 };
    recordPopupSeen(p, t0);
    recordPopupSeen(p, t0 + DAY, { dismissed: true });
    expect(popupFrequencyAllows(p, t0 + 2 * DAY + 1000)).toBe(false);
    expect(popupFrequencyAllows(p, t0 + 3 * DAY)).toBe(true);
  });

  it("a new campaign version is shown again", () => {
    const p = { ...base, frequency: "DAILY" };
    recordPopupSeen(p, t0);
    expect(popupFrequencyAllows({ ...p, version: 2 }, t0 + 1000)).toBe(true);
  });

  it("falls back to in-memory tracking when storage throws", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const getSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const p = { ...base, frequency: "DAILY" };
    expect(() => recordPopupSeen(p, t0)).not.toThrow();
    expect(popupFrequencyAllows(p, t0 + 1000)).toBe(false);
    spy.mockRestore();
    getSpy.mockRestore();
  });

  it("shouldShowPopup combines enabled, title, targeting and frequency", () => {
    expect(shouldShowPopup(base, "/", t0)).toBe(true);
    expect(shouldShowPopup({ ...base, enabled: false }, "/", t0)).toBe(false);
    expect(shouldShowPopup({ ...base, title: "" }, "/", t0)).toBe(false);
    expect(shouldShowPopup(base, "/shop", t0)).toBe(false);
  });

  it("only allows relative or http(s) CTA links", () => {
    expect(safePopupHref("/gifting")).toBe("/gifting");
    expect(safePopupHref("https://x.com")).toBe("https://x.com");
    expect(safePopupHref("javascript:alert(1)")).toBe("");
    expect(safePopupHref("//evil.com")).toBe("");
  });
});

describe("PromoPopup component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  async function mountAt(path, popup = base) {
    vi.mocked(fetchPromoPopup).mockResolvedValue({ data: popup });
    const utils = render(
      <MemoryRouter initialEntries={[path]}>
        <button data-testid="opener">opener</button>
        <PromoPopup />
      </MemoryRouter>
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    return utils;
  }

  it("appears only after the configured delay, as a labelled modal dialog", async () => {
    await mountAt("/");
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(2900);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("Diwali gifting");
    expect(screen.getByText("Handcrafted gifts")).toBeInTheDocument();
    expect(screen.getByTestId("promo-popup-cta")).toHaveAttribute("href", "/gifting");
    expect(screen.getByRole("button", { name: "Not now" })).toBeInTheDocument();
  });

  it("is not full-screen on mobile (capped size, bottom sheet) and does not take layout space", async () => {
    await mountAt("/");
    await act(async () => {
      vi.advanceTimersByTime(3100);
    });
    expect(screen.getByTestId("promo-popup").className).toMatch(/max-h-\[85vh\]/);
    expect(screen.getByTestId("promo-popup").className).toMatch(/max-w-md/);
    expect(screen.getByTestId("promo-popup-overlay").className).toMatch(/\bfixed\b/);
  });

  it("closes on ESC, restores focus, and does not return in the same session", async () => {
    const { rerender } = await mountAt("/");
    const opener = screen.getByTestId("opener");
    opener.focus();
    await act(async () => {
      vi.advanceTimersByTime(3100);
    });
    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);
    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(window.sessionStorage.getItem("promoPopup:1")).toContain("dismissedAt");
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    rerender(<div />);
  });

  it("closes from the close button, the dismiss button and the backdrop", async () => {
    for (const how of ["close", "dismiss", "backdrop"]) {
      window.sessionStorage.clear();
      resetPopupMemory();
      resetPromoPopupCache();
      const { unmount } = await mountAt("/");
      await act(async () => {
        vi.advanceTimersByTime(3100);
      });
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      await act(async () => {
        if (how === "close") fireEvent.click(screen.getByTestId("promo-popup-close"));
        if (how === "dismiss") fireEvent.click(screen.getByTestId("promo-popup-dismiss"));
        if (how === "backdrop") fireEvent.mouseDown(screen.getByTestId("promo-popup-overlay"));
      });
      expect(screen.queryByRole("dialog")).toBeNull();
      unmount();
    }
  });

  it("traps Tab focus inside the dialog", async () => {
    await mountAt("/");
    await act(async () => {
      vi.advanceTimersByTime(3100);
    });
    const dialog = screen.getByRole("dialog");
    const buttons = [screen.getByTestId("promo-popup-close"), screen.getByTestId("promo-popup-cta"), screen.getByTestId("promo-popup-dismiss")];
    buttons[2].focus();
    await act(async () => {
      fireEvent.keyDown(document, { key: "Tab" });
    });
    expect(document.activeElement).toBe(buttons[0]);
    await act(async () => {
      fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    });
    expect(document.activeElement).toBe(buttons[2]);
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("does not show on a page outside the targeting", async () => {
    await mountAt("/shop");
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it.each(["/checkout", "/payment/return", "/admin/popup"])("does not show on %s even when targeting ALL", async (path) => {
    await mountAt(path, { ...base, targeting: "ALL" });
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows nothing when the API has no active popup", async () => {
    vi.mocked(fetchPromoPopup).mockResolvedValue({ data: null });
    render(
      <MemoryRouter initialEntries={["/"]}>
        <PromoPopup />
      </MemoryRouter>
    );
    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(10000);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows nothing when the request fails", async () => {
    vi.mocked(fetchPromoPopup).mockRejectedValue(new Error("down"));
    render(
      <MemoryRouter initialEntries={["/"]}>
        <PromoPopup />
      </MemoryRouter>
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(10000);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not show again within the DAILY window across page loads", async () => {
    const daily = { ...base, frequency: "DAILY" };
    const first = await mountAt("/", daily);
    await act(async () => {
      vi.advanceTimersByTime(3100);
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    first.unmount();
    resetPromoPopupCache();
    await mountAt("/", daily);
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
