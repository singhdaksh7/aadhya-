import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BrandLogo from "../src/components/BrandLogo";

describe("BrandLogo", () => {
  it("renders the text fallback when no src is configured", () => {
    render(<BrandLogo src="" fallbackText="Tushaqsa" />);
    expect(screen.getByText("Tushaqsa")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("normalizes a relative /uploads/... path against the API origin", () => {
    render(<BrandLogo src="/uploads/products/logo.png" alt="Tushaqsa Logo" />);
    const img = screen.getByAltText("Tushaqsa Logo");
    expect(img.getAttribute("src")).toMatch(/\/uploads\/products\/logo\.png$/);
  });

  it("passes an absolute https URL through unchanged", () => {
    render(<BrandLogo src="https://cdn.example.com/logo.png" alt="Tushaqsa Logo" />);
    const img = screen.getByAltText("Tushaqsa Logo");
    expect(img.getAttribute("src")).toBe("https://cdn.example.com/logo.png");
  });

  it("falls back to text if the resolved logo image fails to load", () => {
    render(<BrandLogo src="/uploads/products/broken.png" fallbackText="Tushaqsa" alt="Tushaqsa Logo" />);
    const img = screen.getByAltText("Tushaqsa Logo");
    fireEvent.error(img);
    expect(screen.getByText("Tushaqsa")).toBeInTheDocument();
    expect(screen.queryByAltText("Tushaqsa Logo")).not.toBeInTheDocument();
  });

  it("applies the configured width in pixels", () => {
    render(<BrandLogo src="https://cdn.example.com/logo.png" alt="Tushaqsa Logo" widthPx={180} />);
    const img = screen.getByAltText("Tushaqsa Logo");
    expect(img.style.width).toBe("180px");
  });

  it("honors both width and height when both are configured, with object-fit contain (no crop)", () => {
    render(<BrandLogo src="https://cdn.example.com/logo.png" alt="Tushaqsa Logo" widthPx={400} heightPx={150} />);
    const img = screen.getByAltText("Tushaqsa Logo");
    expect(img.style.width).toBe("400px");
    expect(img.style.height).toBe("150px");
    expect(img.style.maxHeight).toBe("");
    expect(img.className).toMatch(/object-contain/);
  });

  it("leaves height auto with only a width, and width auto with only a height", () => {
    const { rerender } = render(<BrandLogo src="https://cdn.example.com/logo.png" alt="Tushaqsa Logo" widthPx={140} />);
    expect(screen.getByAltText("Tushaqsa Logo").style.height).toBe("");
    rerender(<BrandLogo src="https://cdn.example.com/logo.png" alt="Tushaqsa Logo" heightPx={90} />);
    expect(screen.getByAltText("Tushaqsa Logo").style.width).toBe("");
    expect(screen.getByAltText("Tushaqsa Logo").style.height).toBe("90px");
  });
});
