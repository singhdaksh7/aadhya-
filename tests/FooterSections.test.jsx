import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Footer from "../src/components/Footer";

let mockSettings = {};
vi.mock("../src/hooks/useSiteSettings", () => ({
  useSiteSettings: () => mockSettings,
}));

function renderFooter(footer = {}, extra = {}) {
  mockSettings = { general: {}, social: {}, branding: {}, footer, ...extra };
  return render(
    <BrowserRouter>
      <Footer />
    </BrowserRouter>
  );
}

describe("Footer new sections: empty state", () => {
  it("renders none of the new sections when settings are empty", () => {
    renderFooter({});
    for (const id of ["footer-company-block", "footer-contact-items", "footer-seo-band", "footer-payment-badges", "footer-image-top", "footer-image-brand", "footer-image-bottom"]) {
      expect(screen.queryByTestId(id)).not.toBeInTheDocument();
    }
    expect(screen.queryByText("Contact")).not.toBeInTheDocument();
  });

  it("renders nothing for explicitly empty/disabled sections", () => {
    renderFooter({
      companyBlock: { enabled: false, heading: "X", lines: ["a"] },
      contactItems: [],
      seoSections: [],
      paymentBadges: [],
      image: { enabled: false, image: "/uploads/a.png" },
    });
    expect(screen.queryByTestId("footer-company-block")).not.toBeInTheDocument();
    expect(screen.queryByTestId("footer-seo-band")).not.toBeInTheDocument();
    expect(screen.queryByTestId("footer-image-brand")).not.toBeInTheDocument();
  });
});

describe("Footer company block", () => {
  it("renders heading and lines as plain text (never HTML)", () => {
    renderFooter({ companyBlock: { enabled: true, heading: "Manufactured By", lines: ["Example Company Pvt Ltd", "Sample Street", "<b>bold</b>"] } });
    const block = screen.getByTestId("footer-company-block");
    expect(within(block).getByText("Manufactured By")).toBeInTheDocument();
    expect(within(block).getByText("Example Company Pvt Ltd")).toBeInTheDocument();
    expect(within(block).getByText("Sample Street")).toBeInTheDocument();
    expect(within(block).getByText("<b>bold</b>")).toBeInTheDocument();
    expect(block.querySelector("b")).toBeNull();
  });
});

describe("Footer contact rows", () => {
  it("renders linked and unlinked rows with tel/mailto hrefs", () => {
    renderFooter({
      contactItems: [
        { id: "1", enabled: true, label: "Mobile", value: "+00 000 000 0000", url: "tel:+000000000000", sortOrder: 1 },
        { id: "2", enabled: true, label: "Email", value: "hello@example.com", url: "mailto:hello@example.com", sortOrder: 2 },
        { id: "3", enabled: true, label: "Landline", value: "000-0000", url: "", sortOrder: 3 },
      ],
    });
    expect(screen.getByText("Contact")).toBeInTheDocument();
    expect(screen.getByText("+00 000 000 0000").closest("a")).toHaveAttribute("href", "tel:+000000000000");
    expect(screen.getByText("hello@example.com").closest("a")).toHaveAttribute("href", "mailto:hello@example.com");
    expect(screen.getByText("000-0000").closest("a")).toBeNull();
  });

  it("does not render unsafe URLs as links and hides disabled rows", () => {
    renderFooter({
      contactItems: [
        { id: "1", enabled: true, label: "Bad", value: "Unsafe Value", url: "javascript:alert(1)" },
        { id: "2", enabled: false, label: "Off", value: "Hidden Value", url: "tel:+000" },
      ],
    });
    expect(screen.getByText("Unsafe Value").closest("a")).toBeNull();
    expect(screen.queryByText("Hidden Value")).not.toBeInTheDocument();
  });

  it("keeps the existing general contact details unchanged", () => {
    renderFooter({ contactItems: [{ id: "1", label: "A", value: "Row", url: "" }] }, { general: { supportEmail: "support@example.com" } });
    expect(screen.getByText("support@example.com")).toBeInTheDocument();
    expect(screen.getByText("Row")).toBeInTheDocument();
  });
});

describe("Footer SEO band", () => {
  const sections = [
    {
      id: "s1",
      enabled: true,
      sortOrder: 1,
      heading: "Popular Searches",
      text: "Sample paragraph text.",
      links: [
        { label: "Internal One", url: "/shop" },
        { label: "External Two", url: "https://example.com/two" },
        { label: "Evil", url: "javascript:alert(1)" },
        { label: "Internal Three", url: "/three" },
      ],
    },
    { id: "s2", enabled: false, heading: "Disabled Band", links: [{ label: "Nope", url: "/n" }] },
  ];

  it("renders heading, paragraph and links with separators, skipping unsafe links and disabled sections", () => {
    renderFooter({ seoSections: sections });
    const band = screen.getByTestId("footer-seo-band");
    expect(within(band).getByText("Popular Searches")).toBeInTheDocument();
    expect(within(band).getByText("Sample paragraph text.")).toBeInTheDocument();
    expect(within(band).getByText("Internal One").closest("a")).toHaveAttribute("href", "/shop");
    expect(within(band).queryByText("Evil")).not.toBeInTheDocument();
    expect(within(band).queryByText("Disabled Band")).not.toBeInTheDocument();
    expect(band.querySelectorAll('[aria-hidden="true"]').length).toBe(2);
    expect(band.textContent).toContain("|");
  });

  it("opens external links in a new tab safely, not internal ones", () => {
    renderFooter({ seoSections: sections });
    const ext = screen.getByText("External Two");
    expect(ext).toHaveAttribute("target", "_blank");
    expect(ext).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("Internal One")).not.toHaveAttribute("target");
  });

  it("sits between the columns and the bottom bar", () => {
    const { container } = renderFooter({ seoSections: sections });
    const band = screen.getByTestId("footer-seo-band");
    const copyright = screen.getByText(/All rights reserved/);
    expect(band.compareDocumentPosition(copyright) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector("h4").compareDocumentPosition(band) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("Footer payment badges", () => {
  it("renders badge images and not the text fallback", () => {
    renderFooter({
      paymentIcons: ["Visa"],
      paymentBadges: [{ id: "b1", label: "Sample Pay", image: "https://example.com/pay.png" }],
    });
    const img = screen.getByAltText("Sample Pay");
    expect(img).toHaveAttribute("src", "https://example.com/pay.png");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(screen.queryByText("Visa")).not.toBeInTheDocument();
  });

  it("falls back to text icons when no badge has an image", () => {
    renderFooter({ paymentIcons: ["Visa"], paymentBadges: [{ id: "b1", label: "Empty", image: "" }] });
    expect(screen.getByText("Visa")).toBeInTheDocument();
  });

  it("removes a badge whose image fails to load", () => {
    renderFooter({ paymentBadges: [{ id: "b1", label: "Broken Pay", image: "https://example.com/x.png" }] });
    fireEvent.error(screen.getByAltText("Broken Pay"));
    expect(screen.queryByAltText("Broken Pay")).not.toBeInTheDocument();
  });
});

describe("Footer link columns", () => {
  const cols = (n) =>
    Array.from({ length: n }, (_, i) => ({
      id: `c${i}`,
      title: `Column ${i + 1}`,
      enabled: true,
      links: [{ label: `Link ${i + 1}`, type: "CUSTOM_URL", url: `/p${i}` }],
    }));

  it.each([6, 8])("renders %i columns", (n) => {
    const { container } = renderFooter({ footerColumns: cols(n) });
    for (let i = 1; i <= n; i++) expect(screen.getByText(`Column ${i}`)).toBeInTheDocument();
    const grid = container.querySelector(".grid");
    expect(grid.className).toContain("lg:grid-cols-6");
  });

  it("hides disabled columns and keeps the classic grid for three columns", () => {
    const list = cols(3);
    list[1].enabled = false;
    const { container } = renderFooter({ footerColumns: list });
    expect(screen.queryByText("Column 2")).not.toBeInTheDocument();
    expect(container.querySelector(".grid").className).toContain("md:grid-cols-5");
  });

  it("opens external custom column links in a new tab", () => {
    renderFooter({ footerColumns: [{ id: "x", title: "T", links: [{ label: "Out", type: "CUSTOM_URL", url: "https://example.com" }] }] });
    expect(screen.getByText("Out")).toHaveAttribute("target", "_blank");
  });
});

describe("Footer image", () => {
  const base = { enabled: true, image: "https://example.com/banner.png", alt: "Sample banner", placement: "TOP", maxWidth: 500, showOnMobile: true };

  it("renders nothing when enabled without an image", () => {
    renderFooter({ image: { ...base, image: "" } });
    expect(screen.queryByAltText("Sample banner")).not.toBeInTheDocument();
  });

  it.each([
    ["TOP", "footer-image-top"],
    ["BRAND", "footer-image-brand"],
    ["BOTTOM", "footer-image-bottom"],
  ])("renders only in the %s slot", (placement, testId) => {
    renderFooter({ image: { ...base, placement } });
    expect(screen.getAllByAltText("Sample banner")).toHaveLength(1);
    expect(screen.getByTestId(testId)).toBeInTheDocument();
  });

  it("is responsive, lazy and capped by maxWidth", () => {
    renderFooter({ image: base });
    const img = screen.getByAltText("Sample banner");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img.style.width).toBe("100%");
    expect(img.style.height).toBe("auto");
    expect(screen.getByTestId("footer-image-top").style.maxWidth).toBe("500px");
  });

  it("defaults to 400px and clamps to 1200px", () => {
    const { unmount } = renderFooter({ image: { ...base, maxWidth: undefined } });
    expect(screen.getByTestId("footer-image-top").style.maxWidth).toBe("400px");
    unmount();
    renderFooter({ image: { ...base, maxWidth: 99999 } });
    expect(screen.getByTestId("footer-image-top").style.maxWidth).toBe("1200px");
  });

  it("links externally with safe attributes, internally without target, never for unsafe urls", () => {
    const { unmount } = renderFooter({ image: { ...base, linkUrl: "https://example.com/go" } });
    let a = screen.getByAltText("Sample banner").closest("a");
    expect(a).toHaveAttribute("href", "https://example.com/go");
    expect(a).toHaveAttribute("target", "_blank");
    expect(a).toHaveAttribute("rel", "noopener noreferrer");
    unmount();
    const r2 = renderFooter({ image: { ...base, linkUrl: "/shop" } });
    a = screen.getByAltText("Sample banner").closest("a");
    expect(a).toHaveAttribute("href", "/shop");
    expect(a).not.toHaveAttribute("target");
    r2.unmount();
    renderFooter({ image: { ...base, linkUrl: "javascript:alert(1)" } });
    expect(screen.getByAltText("Sample banner").closest("a")).toBeNull();
  });

  it("removes a broken image instead of showing a broken icon", () => {
    renderFooter({ image: base });
    fireEvent.error(screen.getByAltText("Sample banner"));
    expect(screen.queryByAltText("Sample banner")).not.toBeInTheDocument();
    expect(screen.queryByTestId("footer-image-top")).not.toBeInTheDocument();
  });

  it("hides on mobile only when showOnMobile is false", () => {
    const { unmount } = renderFooter({ image: { ...base, showOnMobile: false } });
    expect(screen.getByTestId("footer-image-top").className).toContain("hidden sm:block");
    unmount();
    renderFooter({ image: base });
    expect(screen.getByTestId("footer-image-top").className).not.toContain("hidden");
  });
});

describe("Footer developer credit is untouched", () => {
  it("still renders the fixed credit", () => {
    renderFooter({});
    expect(screen.getByTestId("footer-credit")).toBeInTheDocument();
  });
});
