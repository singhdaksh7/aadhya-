import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import HeroBannerCarousel from "../src/components/HeroBannerCarousel";

vi.mock("../src/hooks/useSiteSettings", () => ({ useSiteSettings: () => ({ heroBanners: [] }) }));
vi.mock("../src/lib/api", async (importOriginal) => ({
  ...(await importOriginal()),
  fetchBanners: vi.fn(() => Promise.resolve({ data: [] })),
  resolveMediaUrl: (u) => (u && u.startsWith("/uploads/") ? `https://api.example.test${u}` : u),
}));

describe("hero banner media", () => {
  it("resolves admin-uploaded relative paths against the API origin (desktop and mobile)", () => {
    const banner = { id: "h", desktopImage: "/uploads/products/hero.png", mobileImage: "/uploads/products/hero-m.png", headline: "Decor", primaryCtaLabel: "Shop", primaryCtaUrl: "/shop" };
    const { container } = render(<BrowserRouter><HeroBannerCarousel bannersOverride={[banner]} /></BrowserRouter>);
    expect(container.querySelector("img").getAttribute("src")).toBe("https://api.example.test/uploads/products/hero.png");
    expect(container.querySelector("source").getAttribute("srcset")).toBe("https://api.example.test/uploads/products/hero-m.png");
  });
});
