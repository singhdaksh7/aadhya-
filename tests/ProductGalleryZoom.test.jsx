import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { useState } from "react";
import ProductGallery from "../src/components/shop/ProductGallery";

const IMGS = ["/uploads/products/a1.png", "/uploads/products/b2.png", "/uploads/products/c3.png"];

function Harness({ images = IMGS, start = 0 }) {
  const [i, setI] = useState(start);
  return (<div><span data-testid="idx">{i}</span><ProductGallery images={images} index={i} onIndexChange={setI} alt="Vase" /></div>);
}
const mainSrc = () => screen.getByTestId("pdp-zoom-trigger").querySelector("img").getAttribute("src");
const idx = () => Number(screen.getByTestId("idx").textContent);

beforeEach(() => { document.body.style.overflow = ""; });

describe("PDP gallery arrows", () => {
  it("next / previous change the image and thumbnail", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Next product image" }));
    expect(idx()).toBe(1);
    expect(mainSrc()).toContain("b2.png");
    expect(screen.getByRole("button", { name: "View image 2" })).toHaveAttribute("aria-current", "true");
    fireEvent.click(screen.getByRole("button", { name: "Previous product image" }));
    expect(idx()).toBe(0);
  });

  it("loops at both ends", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Previous product image" }));
    expect(idx()).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Next product image" }));
    expect(idx()).toBe(0);
  });

  it("single image hides arrows, thumbnails and counter", () => {
    render(<Harness images={[IMGS[0]]} />);
    expect(screen.queryByRole("button", { name: /product image/ })).toBeNull();
    expect(screen.queryByTestId("pdp-gallery-counter")).toBeNull();
    expect(screen.getByTestId("pdp-zoom-trigger")).toBeInTheDocument();
  });

  it("thumbnail click sets the index and arrows continue from it", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "View image 3" }));
    expect(idx()).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Next product image" }));
    expect(idx()).toBe(0);
  });

  it("horizontal swipe changes image; vertical movement does not", () => {
    render(<Harness />);
    const t = screen.getByTestId("pdp-zoom-trigger");
    fireEvent.touchStart(t, { touches: [{ clientX: 300, clientY: 100 }] });
    fireEvent.touchEnd(t, { changedTouches: [{ clientX: 150, clientY: 110 }] });
    expect(idx()).toBe(1);
    fireEvent.touchStart(t, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchEnd(t, { changedTouches: [{ clientX: 110, clientY: 300 }] });
    expect(idx()).toBe(1);
  });

  it("a broken image shows the branded fallback, not alt text, and arrows still work", () => {
    render(<Harness />);
    fireEvent.error(screen.getByTestId("pdp-zoom-trigger").querySelector("img"));
    expect(screen.getByTestId("image-fallback")).toBeInTheDocument();
    expect(screen.queryByAltText("Vase")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next product image" }));
    expect(idx()).toBe(1);
    expect(screen.queryByTestId("image-fallback")).toBeNull();
    expect(mainSrc()).toContain("b2.png");
  });
});

describe("PDP zoom lightbox", () => {
  const open = (start = 0) => { render(<Harness start={start} />); fireEvent.click(screen.getByTestId("pdp-zoom-trigger")); return screen.getByRole("dialog"); };

  it("original is not requested until the viewer opens", () => {
    render(<Harness />);
    const srcs = () => [...document.querySelectorAll("img")].map((i) => i.getAttribute("src"));
    expect(srcs().includes(IMGS[0])).toBe(false);
    fireEvent.click(screen.getByTestId("pdp-zoom-trigger"));
    expect(screen.getByTestId("lightbox-image")).toHaveAttribute("src", IMGS[0]);
  });

  it("opens as an accessible modal dialog on the current image with a counter", () => {
    const d = open(2);
    expect(d).toHaveAttribute("aria-modal", "true");
    expect(within(d).getByTestId("lightbox-image")).toHaveAttribute("src", IMGS[2]);
    expect(within(d).getByTestId("lightbox-counter")).toHaveTextContent("3 / 3");
    expect(within(d).getByRole("button", { name: "Close image viewer" })).toHaveFocus();
  });

  it("next/previous inside the viewer keep the PDP in sync after close", () => {
    const d = open(2);
    fireEvent.click(within(d).getByRole("button", { name: "Next image" }));
    expect(within(d).getByTestId("lightbox-counter")).toHaveTextContent("1 / 3");
    fireEvent.click(within(d).getByRole("button", { name: "Next image" }));
    expect(within(d).getByTestId("lightbox-image")).toHaveAttribute("src", IMGS[1]);
    fireEvent.click(within(d).getByRole("button", { name: "Close image viewer" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(idx()).toBe(1);
    expect(mainSrc()).toContain("b2.png");
  });

  it("keyboard: arrows navigate, Escape closes", () => {
    open(0);
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(idx()).toBe(1);
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(idx()).toBe(2);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("locks body scroll while open and restores it on close", () => {
    document.body.style.overflow = "auto";
    open();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.body.style.overflow).toBe("auto");
  });

  it("zoom buttons and +/- keys change the scale", () => {
    const d = open();
    const scaleOf = () => /scale\(([\d.]+)\)/.exec(within(d).getByTestId("lightbox-image").parentElement.style.transform)[1];
    expect(scaleOf()).toBe("1");
    fireEvent.click(within(d).getByRole("button", { name: "Zoom in" }));
    expect(Number(scaleOf())).toBeGreaterThan(1);
    fireEvent.keyDown(document, { key: "-" });
    expect(scaleOf()).toBe("1");
    fireEvent.keyDown(document, { key: "+" });
    expect(Number(scaleOf())).toBeGreaterThan(1);
  });

  it("single image: no arrows in the viewer, still opens", () => {
    render(<Harness images={[IMGS[0]]} />);
    fireEvent.click(screen.getByTestId("pdp-zoom-trigger"));
    const d = screen.getByRole("dialog");
    expect(within(d).queryByRole("button", { name: "Next image" })).toBeNull();
    expect(within(d).getByTestId("lightbox-counter")).toHaveTextContent("");
  });

  it("broken viewer image falls back to the branded placeholder and navigation stays", () => {
    const d = open();
    d.querySelectorAll("img").forEach((i) => fireEvent.error(i));
    expect(within(d).getByTestId("image-fallback")).toBeInTheDocument();
    expect(within(d).getByRole("button", { name: "Next image" })).toBeInTheDocument();
  });
});
