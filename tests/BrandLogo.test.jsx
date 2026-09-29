import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BrandLogo from "../src/components/BrandLogo";

describe("BrandLogo", () => {
  it("renders the text fallback when no src is configured", () => {
    render(<BrandLogo src="" fallbackText="Aadya" />);
    expect(screen.getByText("Aadya")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("normalizes a relative /uploads/... path against the API origin", () => {
    render(<BrandLogo src="/uploads/products/logo.png" alt="Aadya Logo" />);
    const img = screen.getByAltText("Aadya Logo");
    expect(img.getAttribute("src")).toMatch(/\/uploads\/products\/logo\.png$/);
  });

  it("passes an absolute https URL through unchanged", () => {
    render(<BrandLogo src="https://cdn.example.com/logo.png" alt="Aadya Logo" />);
    const img = screen.getByAltText("Aadya Logo");
    expect(img.getAttribute("src")).toBe("https://cdn.example.com/logo.png");
  });

  it("falls back to text if the resolved logo image fails to load", () => {
    render(<BrandLogo src="/uploads/products/broken.png" fallbackText="Aadya" alt="Aadya Logo" />);
    const img = screen.getByAltText("Aadya Logo");
    fireEvent.error(img);
    expect(screen.getByText("Aadya")).toBeInTheDocument();
    expect(screen.queryByAltText("Aadya Logo")).not.toBeInTheDocument();
  });

  it("applies the configured width in pixels", () => {
    render(<BrandLogo src="https://cdn.example.com/logo.png" alt="Aadya Logo" widthPx={180} />);
    const img = screen.getByAltText("Aadya Logo");
    expect(img.style.width).toBe("180px");
  });

  it("caps height with max-height rather than fixing it, so tall/wide/square sources keep their own aspect ratio", () => {
    render(<BrandLogo src="https://cdn.example.com/logo.png" alt="Aadya Logo" widthPx={140} maxHeightPx={60} />);
    const img = screen.getByAltText("Aadya Logo");
    expect(img.style.maxHeight).toBe("60px");
    expect(img.style.height).toBe(""); // never a fixed height — only capped
    expect(img.className).toMatch(/object-contain/);
    expect(img.className).toMatch(/object-center/);
  });

  it("renders desktop and mobile max-heights independently (e.g. 60px desktop / 44px mobile)", () => {
    const { rerender } = render(<BrandLogo src="https://cdn.example.com/logo.png" alt="Aadya Logo" widthPx={140} maxHeightPx={60} />);
    expect(screen.getByAltText("Aadya Logo").style.maxHeight).toBe("60px");
    rerender(<BrandLogo src="https://cdn.example.com/logo.png" alt="Aadya Logo" widthPx={110} maxHeightPx={44} />);
    expect(screen.getByAltText("Aadya Logo").style.maxHeight).toBe("44px");
    expect(screen.getByAltText("Aadya Logo").style.width).toBe("110px");
  });

  it("renders without a fixed max-height when maxHeightPx is not provided (backward compatible)", () => {
    render(<BrandLogo src="https://cdn.example.com/logo.png" alt="Aadya Logo" widthPx={140} />);
    const img = screen.getByAltText("Aadya Logo");
    expect(img.style.maxHeight).toBe("");
  });
});
