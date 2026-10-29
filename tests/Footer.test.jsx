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

  it("falls back to the primary logo when no dedicated footer logo is set", () => {
    mockSettings = {
      general: { storeName: "Tushaqsa" },
      footer: { socialHeading: "Connect With Us" },
      social: {},
      branding: { desktopLogo: "/uploads/products/logo.png" },
    };
    renderFooter();

    const img = screen.getByAltText("Tushaqsa");
    expect(img.getAttribute("src")).toMatch(/\/uploads\/products\/logo\.png$/);
  });

  it("prefers a dedicated footer logo over the primary logo when both are set", () => {
    mockSettings = {
      general: { storeName: "Tushaqsa" },
      footer: { socialHeading: "Connect With Us", footerLogo: "/uploads/products/footer-logo.png" },
      social: {},
      branding: { desktopLogo: "/uploads/products/logo.png" },
    };
    renderFooter();

    const img = screen.getByAltText("Tushaqsa");
    expect(img.getAttribute("src")).toMatch(/\/uploads\/products\/footer-logo\.png$/);
  });

  it("falls back to the text wordmark when neither logo is set", () => {
    mockSettings = {
      general: { storeName: "Tushaqsa" },
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
});

describe("Footer developer credit", () => {
  it("always shows the Digital Clik credit line, independent of any store setting", () => {
    mockSettings = { general: {} };
    renderFooter();
    expect(screen.getByTestId("footer-credit")).toHaveTextContent(`© Copyright ${new Date().getFullYear()}. All Rights Reserved. Made with ❤️ by Team Digital Clik`);
  });

  it("cannot be switched off, renamed or re-pointed through site settings", () => {
    mockSettings = { general: {}, footer: { credit: { enabled: false, prefix: "Hacked by", name: "Someone Else", url: "https://evil.example" } } };
    renderFooter();
    const credit = screen.getByTestId("footer-credit");
    expect(credit).toHaveTextContent("Made with ❤️ by Team Digital Clik");
    expect(credit.querySelector("a")).toBeNull();
    expect(credit.textContent).not.toContain("Someone Else");
  });
});

describe("Footer logo sizing", () => {
  const settingsWith = () => ({
    ...mockSettings,
    branding: {},
    footer: { footerLogo: "/uploads/products/footer-logo.png", footerLogoWidth: 300, footerLogoHeight: 120, footerLogoWidthMobile: 200, footerLogoStyle: "WHITE_SILHOUETTE" },
  });

  it("honors admin desktop width/height, has no brightness filter, and applies the chosen style", () => {
    mockSettings = settingsWith();
    const { container } = renderFooter();
    const img = container.querySelector("footer img");
    expect(img.style.width).toBe("300px");
    expect(img.style.height).toBe("120px");
    expect(img.style.maxWidth).toBe("100%");
    expect(img.className).not.toMatch(/brightness-200/);
    expect(img.className).toMatch(/invert/);
  });

  it("uses the mobile size on small screens", () => {
    mockSettings = settingsWith();
    const orig = window.matchMedia;
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    const { container } = renderFooter();
    window.matchMedia = orig;
    expect(container.querySelector("footer img").style.width).toBe("200px");
  });

  it("renders a transparent logo directly on the footer: no plate/box, even for a saved LIGHT_PLATE style", () => {
    const base = settingsWith();
    mockSettings = { ...base, footer: { ...base.footer, footerLogoStyle: "LIGHT_PLATE" } };
    const { container } = renderFooter();
    const img = container.querySelector("footer img");
    expect(img.className).toMatch(/object-contain/);
    expect(img.className).not.toMatch(/invert/);
    for (let el = img; el && el.tagName !== "FOOTER"; el = el.parentElement) {
      expect(el.className).not.toMatch(/bg-|rounded|\bp-\d/);
      expect(el.style.backgroundColor).toBe("");
    }
  });
});
