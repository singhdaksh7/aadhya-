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
});
