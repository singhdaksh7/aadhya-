import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CategoryBannerCarousel from "../src/components/CategoryBannerCarousel";

const slide = (id) => ({ id, desktop: `/uploads/${id}-d.jpg`, mobile: `/uploads/${id}-m.jpg` });
const renderBanner = (slides) => render(<MemoryRouter><CategoryBannerCarousel slides={slides} categoryName="Bags" /></MemoryRouter>);

describe("category banner frame sizes itself to the uploaded image", () => {
  it("single banner: no fixed ratio or height cap, image shown at natural height without cropping", () => {
    renderBanner([slide("a")]);
    const frame = screen.getByTestId("category-banner").firstChild;
    expect(frame.className).not.toMatch(/aspect-/);
    expect(frame.className).not.toMatch(/max-h-/);
    const img = frame.querySelector("img");
    expect(img.className).toContain("h-auto");
    expect(img.className).toContain("w-full");
    expect(img.className).not.toContain("object-cover");
  });

  it("carousel: slides share one grid cell so the frame fits the tallest slide, uncropped", () => {
    renderBanner([slide("a"), slide("b")]);
    const frame = screen.getByTestId("category-banner").firstChild;
    expect(frame.className).toContain("grid");
    expect(frame.className).not.toMatch(/aspect-/);
    const slides = screen.getAllByTestId("category-banner-slide");
    slides.forEach((s) => expect(s.className).toContain("col-start-1"));
    expect(slides[0].querySelector("img").className).toContain("object-contain");
  });

  it("renders nothing without slides", () => {
    const { container } = renderBanner([]);
    expect(container).toBeEmptyDOMElement();
  });
});
