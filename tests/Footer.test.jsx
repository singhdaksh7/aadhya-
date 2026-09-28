import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Footer from "../src/components/Footer";

let mockSettings = {};
vi.mock("../src/hooks/useSiteSettings", () => ({
  useSiteSettings: () => mockSettings,
}));

function renderFooter() {
  return render(
    <BrowserRouter>
      <Footer />
    </BrowserRouter>
  );
}

describe("Footer", () => {
  it("renders the configured address, email and phone from site settings", () => {
    mockSettings = {
      general: {
        businessAddress: "42 Test Lane",
        city: "Testville",
        state: "TS",
        postalCode: "111111",
        country: "Testland",
        supportEmail: "hello@example.com",
        supportPhone: "+1 555-0100",
      },
      footer: { socialHeading: "Connect With Us" },
      social: {},
      branding: {},
    };
    renderFooter();

    expect(screen.getByText(/42 Test Lane/)).toBeInTheDocument();
    expect(screen.getByText("hello@example.com")).toBeInTheDocument();
    expect(screen.getByText("+1 555-0100")).toBeInTheDocument();
  });

  it("renders a dynamic social heading", () => {
    mockSettings = {
      general: {},
      footer: { socialHeading: "Follow Our Journey" },
      social: { instagram: "https://instagram.com/example" },
      branding: {},
    };
    renderFooter();

    expect(screen.getByText("Follow Our Journey")).toBeInTheDocument();
  });

  it("does not render social icons when no URLs are configured", () => {
    mockSettings = {
      general: {},
      footer: { socialHeading: "Connect With Us" },
      social: { instagram: "", facebook: "" },
      branding: {},
    };
    renderFooter();

    expect(screen.queryByText("Connect With Us")).not.toBeInTheDocument();
    expect(screen.queryByText("Instagram")).not.toBeInTheDocument();
  });

  it("hides a social icon whose URL is missing while showing the ones configured", () => {
    mockSettings = {
      general: {},
      footer: { socialHeading: "Connect With Us" },
      social: { instagram: "https://instagram.com/example", facebook: "" },
      branding: {},
    };
    renderFooter();

    expect(screen.getByText("Instagram")).toBeInTheDocument();
    expect(screen.queryByText("Facebook")).not.toBeInTheDocument();
  });

  it("uses safe target/rel attributes on external social links", () => {
    mockSettings = {
      general: {},
      footer: { socialHeading: "Connect With Us" },
      social: { instagram: "https://instagram.com/example" },
      branding: {},
    };
    renderFooter();

    const link = screen.getByText("Instagram");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("does not render contact rows when no contact info is configured", () => {
    mockSettings = {
      general: {},
      footer: { socialHeading: "Connect With Us" },
      social: {},
      branding: {},
    };
    renderFooter();

    expect(screen.queryByText("📍")).not.toBeInTheDocument();
  });
});
