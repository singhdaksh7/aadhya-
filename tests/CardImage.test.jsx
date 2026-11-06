import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CardImage from "../src/components/CardImage";
import { optimizedUrl, canVariant } from "../src/lib/imageVariants";
import { resolveProductImageUrl } from "../src/lib/api";

const U = "https://api.x.com/uploads/products/abc-123.png";

describe("image variants", () => {
  it("serves same-dimension optimized WebP for uploads only", () => {
    expect(canVariant(U)).toBe(true);
    expect(optimizedUrl(U)).toBe(`${U}?w=full`);
    expect(optimizedUrl("https://images.unsplash.com/a.jpg")).toBe("https://images.unsplash.com/a.jpg");
    expect(optimizedUrl("https://x.com/uploads/products/a.svg")).toBe("https://x.com/uploads/products/a.svg");
  });
  it("normalizes media urls without double prefixing", () => {
    expect(resolveProductImageUrl(null)).toBeNull();
    expect(resolveProductImageUrl(U)).toBe(U);
    expect(resolveProductImageUrl("/uploads/products/a.png")).toMatch(/\/uploads\/products\/a\.png$/);
  });
});

describe("CardImage", () => {
  it("lazy by default, eager+high priority when priority", () => {
    const { rerender } = render(<CardImage sources={[U]} alt="Bag" />);
    let img = screen.getByAltText("Bag");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img.getAttribute("src")).toBe(`${U}?w=full`);
    expect(img.hasAttribute("srcset")).toBe(false);
    expect(img).toHaveAttribute("width");
    rerender(<CardImage sources={[U]} alt="Bag" priority />);
    img = screen.getByAltText("Bag");
    expect(img).toHaveAttribute("loading", "eager");
    expect(img).toHaveAttribute("fetchpriority", "high");
  });
  it("shows skeleton until load, then hides it", () => {
    render(<CardImage sources={[U]} alt="Bag" />);
    expect(screen.getByTestId("image-skeleton")).toBeInTheDocument();
    fireEvent.load(screen.getByAltText("Bag"));
    expect(screen.queryByTestId("image-skeleton")).toBeNull();
  });
  it("falls through to the next source, then a branded placeholder with no <img>/alt text", () => {
    const U2 = "https://api.x.com/uploads/products/def-456.png";
    const { container } = render(<CardImage sources={[U, U2]} alt="Bag" />);
    fireEvent.error(screen.getByAltText("Bag"));
    expect(screen.getByAltText("Bag").getAttribute("src")).toContain("def-456");
    fireEvent.error(screen.getByAltText("Bag"));
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByTestId("image-fallback")).toBeInTheDocument();
    expect(container.textContent).not.toContain("Bag");
  });
  it("renders the placeholder when there is no image", () => {
    render(<CardImage sources={[]} alt="Bag" />);
    expect(screen.getByTestId("image-fallback")).toBeInTheDocument();
  });
});

import { imageSizeError, MAX_IMAGE_MB } from "../src/lib/uploadLimits";
describe("admin upload size limit", () => {
  it("rejects heavy images with a clear message and accepts small ones", () => {
    expect(MAX_IMAGE_MB).toBe(10);
    expect(imageSizeError({ size: 12 * 1048576 })).toMatch(/under 10 MB/);
    expect(imageSizeError({ size: 500 * 1024 })).toBeNull();
  });
});
