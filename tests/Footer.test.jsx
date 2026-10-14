import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

  it("falls back to the primary logo when no dedicated footer logo is set", () => {
    mockSettings = {
      general: { storeName: "Aadya" },
      footer: { socialHeading: "Connect With Us" },
      social: {},
      branding: { desktopLogo: "/uploads/products/logo.png" },
    };
    renderFooter();

    const img = screen.getByAltText("Aadya");
    expect(img.getAttribute("src")).toMatch(/\/uploads\/products\/logo\.png$/);
  });

  it("prefers a dedicated footer logo over the primary logo when both are set", () => {
    mockSettings = {
      general: { storeName: "Aadya" },
      footer: { socialHeading: "Connect With Us", footerLogo: "/uploads/products/footer-logo.png" },
      social: {},
      branding: { desktopLogo: "/uploads/products/logo.png" },
    };
    renderFooter();

    const img = screen.getByAltText("Aadya");
    expect(img.getAttribute("src")).toMatch(/\/uploads\/products\/footer-logo\.png$/);
  });

  it("falls back to the text wordmark when neither logo is set", () => {
    mockSettings = {
      general: { storeName: "Aadya" },
      footer: { socialHeading: "Connect With Us" },
      social: {},
      branding: {},
    };
    renderFooter();

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
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

  describe("website credit", () => {
    const credit = (over = {}) => ({ enabled: true, prefix: "Website by", name: "Digital Clik", url: "", logo: "", ...over });
    const withCredit = (c) => { mockSettings = { footer: { credit: c }, general: {} }; renderFooter(); };

    it("shows the admin-set credit text and name at the bottom of the footer", () => {
      withCredit(credit());
      const el = screen.getByTestId("footer-credit");
      expect(el).toHaveTextContent("Website by Digital Clik");
      expect(el.querySelector("a")).toBeNull();
    });

    it("links out safely when a link is set", () => {
      withCredit(credit({ url: "https://digitalclik.example" }));
      const link = screen.getByRole("link", { name: "Digital Clik" });
      expect(link).toHaveAttribute("href", "https://digitalclik.example");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("follows admin edits to the wording and name", () => {
      withCredit(credit({ prefix: "Designed & built by", name: "Studio X" }));
      expect(screen.getByTestId("footer-credit")).toHaveTextContent("Designed & built by Studio X");
    });

    it("is hidden when switched off, when the name is empty, or when not configured", () => {
      const off = render(<BrowserRouter><Footer /></BrowserRouter>);
      off.unmount();
      mockSettings = { footer: { credit: credit({ enabled: false }) }, general: {} };
      const a = render(<BrowserRouter><Footer /></BrowserRouter>); expect(screen.queryByTestId("footer-credit")).toBeNull(); a.unmount();
      mockSettings = { footer: { credit: credit({ name: "  " }) }, general: {} };
      const b = render(<BrowserRouter><Footer /></BrowserRouter>); expect(screen.queryByTestId("footer-credit")).toBeNull(); b.unmount();
      mockSettings = { footer: {}, general: {} };
      render(<BrowserRouter><Footer /></BrowserRouter>); expect(screen.queryByTestId("footer-credit")).toBeNull();
    });

    it("shows an optional logo and drops it if it cannot load", () => {
      withCredit(credit({ logo: "/uploads/dc.png" }));
      const img = screen.getByTestId("footer-credit").querySelector("img");
      expect(img).not.toBeNull();
      fireEvent.error(img);
      expect(screen.getByTestId("footer-credit").querySelector("img")).toBeNull();
      expect(screen.getByTestId("footer-credit")).toHaveTextContent("Digital Clik");
    });
  });
});
