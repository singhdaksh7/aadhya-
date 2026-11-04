import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Footer from "../src/components/Footer";
import FooterArtwork from "../src/components/FooterArtwork";
import FooterSectionsEditor from "../src/components/admin/FooterSectionsEditor";

let mockSettings = {};
vi.mock("../src/hooks/useSiteSettings", () => ({
  useSiteSettings: () => mockSettings,
}));

function renderFooter(footer = {}, extra = {}) {
  mockSettings = { general: { storeName: "Tushaqsa" }, social: {}, branding: {}, footer, ...extra };
  return render(
    <BrowserRouter>
      <Footer />
    </BrowserRouter>
  );
}

describe("FooterArtwork Component Rendering & Modes", () => {
  it("renders null when disabled, missing or empty", () => {
    const { container: c1 } = render(<FooterArtwork artwork={undefined} />);
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(<FooterArtwork artwork={{ enabled: false, desktopImage: "/uploads/art.jpg" }} />);
    expect(c2.firstChild).toBeNull();

    const { container: c3 } = render(<FooterArtwork artwork={{ enabled: true, desktopImage: "", mobileImage: "" }} />);
    expect(c3.firstChild).toBeNull();
  });

  it("renders desktop image with configured alt text", () => {
    render(
      <FooterArtwork
        artwork={{
          enabled: true,
          desktopImage: "/uploads/art-desktop.png",
          alt: "Heritage floral motif",
          isDecorative: false,
        }}
      />
    );
    const wrapper = screen.getByTestId("footer-artwork");
    expect(wrapper).toBeInTheDocument();
    const img = screen.getByAltText("Heritage floral motif");
    expect(img).toHaveAttribute("src", "/uploads/art-desktop.png");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).not.toHaveAttribute("aria-hidden");
  });

  it("renders decorative artwork with empty alt and aria-hidden='true'", () => {
    render(
      <FooterArtwork
        artwork={{
          enabled: true,
          desktopImage: "/uploads/art-desktop.png",
          alt: "Should be ignored because decorative",
          isDecorative: true,
        }}
      />
    );
    const wrapper = screen.getByTestId("footer-artwork");
    const img = wrapper.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveAttribute("aria-hidden", "true");
  });

  it("falls back to desktop image when mobile image is not configured", () => {
    render(
      <FooterArtwork
        artwork={{
          enabled: true,
          desktopImage: "/uploads/art-desktop.png",
          mobileImage: "",
        }}
      />
    );
    const wrapper = screen.getByTestId("footer-artwork");
    expect(wrapper.querySelector("picture")).toBeNull();
    const img = wrapper.querySelector("img");
    expect(img).toHaveAttribute("src", "/uploads/art-desktop.png");
  });

  it("renders responsive picture tag when distinct mobile image is provided", () => {
    render(
      <FooterArtwork
        artwork={{
          enabled: true,
          desktopImage: "/uploads/art-desktop.png",
          mobileImage: "/uploads/art-mobile.png",
        }}
      />
    );
    const wrapper = screen.getByTestId("footer-artwork");
    const picture = wrapper.querySelector("picture");
    expect(picture).toBeInTheDocument();
    const source = picture.querySelector("source");
    expect(source).toHaveAttribute("media", "(max-width: 767px)");
    expect(source).toHaveAttribute("srcset", "/uploads/art-mobile.png");
    const img = picture.querySelector("img");
    expect(img).toHaveAttribute("src", "/uploads/art-desktop.png");
  });

  it("applies cover fit and custom focal positioning", () => {
    render(
      <FooterArtwork
        artwork={{
          enabled: true,
          desktopImage: "/uploads/art.jpg",
          fit: "cover",
          positionX: 50,
          positionY: 70,
          desktopHeight: 360,
          tabletHeight: 300,
          mobileHeight: 240,
        }}
      />
    );
    const wrapper = screen.getByTestId("footer-artwork");
    expect(wrapper.className).toContain("footer-artwork-frame");
    expect(wrapper.style.getPropertyValue("--fa-h-desktop")).toBe("360px");
    expect(wrapper.style.getPropertyValue("--fa-h-tablet")).toBe("300px");
    expect(wrapper.style.getPropertyValue("--fa-h-mobile")).toBe("240px");

    const img = wrapper.querySelector("img");
    expect(img.style.objectFit).toBe("cover");
    expect(img.style.objectPosition).toBe("50% 70%");
  });

  it("applies contain fit mode and background color", () => {
    render(
      <FooterArtwork
        artwork={{
          enabled: true,
          desktopImage: "/uploads/art.jpg",
          fit: "contain",
          backgroundColor: "#1a1a1a",
          positionX: 50,
          positionY: 50,
        }}
      />
    );
    const wrapper = screen.getByTestId("footer-artwork");
    expect(wrapper.style.backgroundColor).toBe("rgb(26, 26, 26)");
    const img = wrapper.querySelector("img");
    expect(img.style.objectFit).toBe("contain");
  });

  it("applies natural height mode with auto height and safeguard max-height", () => {
    render(
      <FooterArtwork
        artwork={{
          enabled: true,
          desktopImage: "/uploads/art.jpg",
          fit: "natural",
          maxHeight: 550,
        }}
      />
    );
    const wrapper = screen.getByTestId("footer-artwork");
    expect(wrapper.className).toContain("h-auto");
    expect(wrapper.className).not.toContain("footer-artwork-frame");
    expect(wrapper.style.maxHeight).toBe("550px");

    const img = wrapper.querySelector("img");
    expect(img.className).toContain("h-auto");
    expect(img.style.maxHeight).toBe("550px");
  });

  it("clamps visual offsets and top spacing within safe bounds", () => {
    render(
      <FooterArtwork
        artwork={{
          enabled: true,
          desktopImage: "/uploads/art.jpg",
          offsetX: 30, // exceeds +20 -> clamped to 20
          offsetY: -35, // exceeds -20 -> clamped to -20
          topSpacing: -55, // exceeds -40 -> clamped to -40
          positionX: 150, // exceeds 100 -> clamped to 100
          positionY: -20, // below 0 -> clamped to 0
        }}
      />
    );
    const wrapper = screen.getByTestId("footer-artwork");
    expect(wrapper.style.marginTop).toBe("-40px");

    const img = wrapper.querySelector("img");
    expect(img.style.transform).toBe("translate3d(20px, -20px, 0)");
    expect(img.style.objectPosition).toBe("100% 0%");
  });

  it("unmounts gracefully if image fails to load (no broken image or empty gap)", () => {
    render(
      <FooterArtwork
        artwork={{
          enabled: true,
          desktopImage: "/uploads/non-existent.jpg",
        }}
      />
    );
    const img = screen.getByTestId("footer-artwork").querySelector("img");
    fireEvent.error(img);
    expect(screen.queryByTestId("footer-artwork")).not.toBeInTheDocument();
  });

  it("wraps image in safe link with optional openInNewTab", () => {
    render(
      <BrowserRouter>
        <FooterArtwork
          artwork={{
            enabled: true,
            desktopImage: "/uploads/art.jpg",
            linkUrl: "https://tushaqsa.com/artisan-story",
            openInNewTab: true,
          }}
        />
      </BrowserRouter>
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://tushaqsa.com/artisan-story");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});

describe("Footer Integration & Backward Compatibility", () => {
  it("remains 100% identical to original layout when artwork is disabled or missing", () => {
    const { container: c1 } = renderFooter({});
    expect(c1.querySelector("footer")).toHaveClass("pb-12");
    expect(c1.querySelector("footer")).not.toHaveClass("pb-0");
    expect(screen.queryByTestId("footer-artwork")).not.toBeInTheDocument();

    const { container: c2 } = renderFooter({
      artwork: { enabled: false, desktopImage: "/uploads/art.jpg" },
    });
    expect(c2.querySelector("footer")).toHaveClass("pb-12");
    expect(screen.queryByTestId("footer-artwork")).not.toBeInTheDocument();
  });

  it("appends full-width artwork at the very bottom of the footer below credit", () => {
    const { container } = renderFooter({
      artwork: {
        enabled: true,
        desktopImage: "/uploads/panoramic-art.jpg",
        alt: "Panoramic craft illustration",
        desktopHeight: 340,
      },
    });

    const footer = container.querySelector("footer");
    expect(footer).toHaveClass("pb-0");
    expect(footer).not.toHaveClass("pb-12");

    const innerDiv = footer.querySelector(".max-w-7xl");
    expect(innerDiv).toHaveClass("pb-12");

    const credit = screen.getByTestId("footer-credit");
    const artwork = screen.getByTestId("footer-artwork");

    expect(credit).toBeInTheDocument();
    expect(artwork).toBeInTheDocument();

    // Verify DOM order: credit appears before artwork, and artwork is the last child of footer
    expect(footer.lastElementChild).toBe(artwork);
  });
});

describe("FooterArtworkEditor in Admin", () => {
  it("renders all admin controls and updates state cleanly", () => {
    const onChange = vi.fn();
    render(
      <FooterSectionsEditor
        footer={{
          artwork: {
            enabled: true,
            desktopImage: "/uploads/art.jpg",
            alt: "Initial Alt",
            fit: "cover",
            desktopHeight: 340,
            positionX: 50,
            positionY: 50,
          },
        }}
        onChange={onChange}
      />
    );

    expect(screen.getByText("Footer Artwork")).toBeInTheDocument();

    // Toggle enabled
    const enableCheckbox = screen.getByLabelText("Enable Footer Artwork");
    expect(enableCheckbox).toBeChecked();
    fireEvent.click(enableCheckbox);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ artwork: expect.objectContaining({ enabled: false }) }));

    // Toggle decorative
    const decorativeCheckbox = screen.getByLabelText("Decorative Artwork (hide from screen readers / empty alt)");
    expect(decorativeCheckbox).not.toBeChecked();
    fireEvent.click(decorativeCheckbox);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ artwork: expect.objectContaining({ isDecorative: true }) }));

    // Change fit mode
    const fitSelect = screen.getByLabelText("Display Mode / Image Fit");
    fireEvent.change(fitSelect, { target: { value: "natural" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ artwork: expect.objectContaining({ fit: "natural" }) }));

    // Change position preset to "top"
    const presetSelect = screen.getByLabelText("Position Preset");
    fireEvent.change(presetSelect, { target: { value: "top" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        artwork: expect.objectContaining({ positionPreset: "top", positionX: 50, positionY: 0 }),
      })
    );

    // Live preview exists with device buttons
    const preview = screen.getByTestId("footer-artwork-preview");
    expect(preview).toBeInTheDocument();
    expect(within(preview).getByText("Desktop")).toBeInTheDocument();
    expect(within(preview).getByText("Tablet")).toBeInTheDocument();
    expect(within(preview).getByText("Mobile (390)")).toBeInTheDocument();

    // Switch preview device to Mobile
    fireEvent.click(within(preview).getByText("Mobile (390)"));
    expect(within(preview).getByText(/Mode:/)).toBeInTheDocument();
  });
});
