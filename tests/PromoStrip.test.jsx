import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import PromoStrip from "../src/components/PromoStrip";

vi.mock("../src/hooks/useSiteSettings", () => ({
  useSiteSettings: () => ({ promoStrip: null }),
}));

vi.mock("../src/lib/api", () => ({
  fetchPromos: () => Promise.resolve({ data: [] }),
}));

describe("PromoStrip", () => {
  it("uses the calm 60-second duration and keeps hover pausing enabled by default", () => {
    const { container } = render(<BrowserRouter><PromoStrip /></BrowserRouter>);

    const ticker = container.querySelector(".animate-marquee-ticker");
    expect(ticker).toHaveStyle({ "--ticker-duration": "60s" });
    expect(ticker).toHaveClass("marquee-ticker-pauseable");
  });

  it("honors existing duration settings and can disable hover pausing", () => {
    const { container } = render(<BrowserRouter><PromoStrip promoConfig={{ speed: 25, pauseOnHover: false }} /></BrowserRouter>);

    const ticker = container.querySelector(".animate-marquee-ticker");
    expect(ticker).toHaveStyle({ "--ticker-duration": "25s" });
    expect(ticker).not.toHaveClass("marquee-ticker-pauseable");
  });
});
