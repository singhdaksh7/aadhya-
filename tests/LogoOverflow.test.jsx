import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("../src/lib/api", () => ({ resolveMediaUrl: (u) => u || null }));
const BrandLogo = (await import("../src/components/BrandLogo")).default;

// Regression: a large admin-configured logo width (e.g. 240px) pushed the mobile search/cart icons
// past the right edge at 320px. The logo must never be wider than the space its container gives it.
describe("BrandLogo overflow safety", () => {
  it("caps width at 100% of its container whatever width is configured", () => {
    const { container } = render(<BrandLogo src="/uploads/logo.png" widthPx={240} heightPx={900} />);
    const img = container.querySelector("img");
    expect(img.style.width).toBe("240px");
    expect(img.style.maxWidth).toBe("100%");
    expect(img.style.height).toBe("900px");
  });
});
