import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CategoryBannerCarousel from "../src/components/CategoryBannerCarousel";

const slide = (id) => ({ id, desktop: `/uploads/${id}-d.jpg`, mobile: `/uploads/${id}-m.jpg` });
const renderBanner = (slides) => render(<MemoryRouter><CategoryBannerCarousel slides={slides} categoryName="Bags" /></MemoryRouter>);

describe("category banner frame keeps its fixed size", () => {
  it("uses the fixed 2:1 phone / 3:1 (max 300px) desktop frame and fills it without distortion", () => {
    renderBanner([slide("a")]);
    const frame = screen.getByTestId("category-banner").firstChild;
    expect(frame.className).toContain("aspect-[2/1]");
    expect(frame.className).toContain("md:aspect-[3/1]");
    expect(frame.className).toContain("md:max-h-[300px]");
    expect(frame.className).toContain("overflow-hidden");
    const img = frame.querySelector("img");
    expect(img.className).toContain("h-full");
    expect(img.className).toContain("w-full");
    expect(img.className).toContain("object-cover");
  });

  it("renders nothing without slides", () => {
    const { container } = renderBanner([]);
    expect(container).toBeEmptyDOMElement();
  });
});
