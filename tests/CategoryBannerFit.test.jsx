import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CategoryBannerCarousel from "../src/components/CategoryBannerCarousel";

const slide = (id, extra = {}) => ({ id, desktop: `/uploads/${id}-d.jpg`, mobile: `/uploads/${id}-m.jpg`, ...extra });
const renderBanner = (slides) =>
  render(<MemoryRouter><CategoryBannerCarousel slides={slides} categoryName="Multipurpose Bags" /></MemoryRouter>);

function loadWith(img, naturalWidth, naturalHeight) {
  Object.defineProperty(img, "naturalWidth", { configurable: true, value: naturalWidth });
  Object.defineProperty(img, "naturalHeight", { configurable: true, value: naturalHeight });
  fireEvent.load(img);
}
const mainImg = () => screen.getByTestId("category-banner").querySelector("img:not([aria-hidden])");

describe("category banner shows the whole image", () => {
  it("starts on a controlled placeholder frame that clips overflow", () => {
    renderBanner([slide("a")]);
    const frame = screen.getByTestId("category-banner").firstChild;
    expect(frame.className).toMatch(/aspect-\[2\/1\]/);
    expect(frame.className).toContain("overflow-hidden");
    expect(frame.className).toContain("w-full");
    const img = mainImg();
    expect(img.className).toContain("h-full");
    expect(img.className).toContain("w-full");
    expect(img.className).toContain("object-center");
  });

  it("matches the frame to a wide banner's own ratio on every breakpoint (no crop, no height cap)", () => {
    renderBanner([slide("wide")]);
    loadWith(mainImg(), 1920, 700);
    const frame = screen.getByTestId("category-banner").firstChild;
    expect(parseFloat(frame.style.aspectRatio)).toBeCloseTo(1920 / 700, 3);
    expect(frame.className).not.toContain("max-h-");
    expect(frame.className).not.toContain("md:aspect-");
    expect(screen.queryByTestId("category-banner-backdrop")).toBeNull();
  });

  it("matches the frame to a portrait banner (clamped to 1:1) and shows it whole", () => {
    renderBanner([slide("tall")]);
    loadWith(mainImg(), 1400, 1710);
    const frame = screen.getByTestId("category-banner").firstChild;
    expect(parseFloat(frame.style.aspectRatio)).toBe(1);
    expect(mainImg().className).toContain("object-contain");
    expect(screen.getByTestId("category-banner-backdrop")).toHaveAttribute("aria-hidden", "true");
  });

  it("never distorts: the image is object-contain or an exact-ratio cover", () => {
    renderBanner([slide("sq")]);
    loadWith(mainImg(), 1000, 1000);
    const frame = screen.getByTestId("category-banner").firstChild;
    expect(parseFloat(frame.style.aspectRatio)).toBe(1);
    expect(mainImg().className).toMatch(/object-(cover|contain)/);
    expect(mainImg().className).not.toMatch(/w-\[|h-\[/);
  });

  it("renders nothing when there are no slides", () => {
    const { container } = renderBanner([]);
    expect(container).toBeEmptyDOMElement();
  });

  it("drops the banner (no empty frame) when its only image fails to load", () => {
    renderBanner([slide("bad")]);
    fireEvent.error(mainImg());
    expect(screen.queryByTestId("category-banner")).toBeNull();
  });

  it("keeps a carousel when only some slides fail", () => {
    renderBanner([slide("a"), slide("b")]);
    const imgs = screen.getAllByTestId("category-banner-slide").map((s) => s.querySelector("img"));
    fireEvent.error(imgs[1]);
    expect(screen.getByTestId("category-banner")).toBeInTheDocument();
  });
});
