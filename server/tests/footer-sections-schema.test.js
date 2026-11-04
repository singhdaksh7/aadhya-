import { describe, expect, it } from "vitest";
import { settingsValidationSchema, DEFAULT_SETTINGS } from "../src/modules/settings/settings.routes.js";

const parse = (footer) => settingsValidationSchema.safeParse({ footer });
const many = (n, make) => Array.from({ length: n }, (_, i) => make(i));

describe("footer sections defaults", () => {
  it("adds no new default sections (footer renders as before until configured)", () => {
    for (const key of ["companyBlock", "contactItems", "seoSections", "paymentBadges", "image", "artwork"]) {
      expect(DEFAULT_SETTINGS.footer[key]).toBeUndefined();
    }
  });

  it("still accepts a footer with none of the new keys", () => {
    expect(parse({ brandDescription: "x" }).success).toBe(true);
  });
});

describe("footer.companyBlock", () => {
  it("accepts a heading and up to 10 lines of 200 chars", () => {
    const lines = many(10, () => "x".repeat(200));
    expect(parse({ companyBlock: { enabled: true, heading: "Example Heading", lines } }).success).toBe(true);
  });
  it("rejects 11 lines or a line over 200 chars", () => {
    expect(parse({ companyBlock: { lines: many(11, () => "a") } }).success).toBe(false);
    expect(parse({ companyBlock: { lines: ["x".repeat(201)] } }).success).toBe(false);
  });
});

describe("footer.contactItems", () => {
  const item = (url) => ({ id: "c1", enabled: true, label: "Phone", value: "+00 000 000 0000", url, sortOrder: 1 });
  it.each(["", "/contact", "https://example.com/x", "http://example.com", "tel:+000000000000", "mailto:hello@example.com"])("accepts url %s", (url) => {
    expect(parse({ contactItems: [item(url)] }).success).toBe(true);
  });
  it.each(["javascript:alert(1)", "data:text/html,hi", "//evil.example", "ftp://example.com", "vbscript:x", "https://a b.com", "JaVaScRiPt:alert(1)"])("rejects url %s", (url) => {
    expect(parse({ contactItems: [item(url)] }).success).toBe(false);
  });
  it("caps at 12 rows", () => {
    expect(parse({ contactItems: many(12, (i) => ({ id: `c${i}` })) }).success).toBe(true);
    expect(parse({ contactItems: many(13, (i) => ({ id: `c${i}` })) }).success).toBe(false);
  });
});

describe("footer.seoSections", () => {
  const section = (over = {}) => ({ id: "s1", enabled: true, heading: "Sample", text: "Sample text", links: [{ label: "A", url: "/a" }], sortOrder: 1, ...over });
  it("accepts relative and http(s) links", () => {
    expect(parse({ seoSections: [section({ links: [{ label: "A", url: "/a" }, { label: "B", url: "https://example.com/b" }] })] }).success).toBe(true);
  });
  it("rejects tel:, mailto: and script links in SEO sections", () => {
    for (const url of ["tel:+000", "mailto:a@example.com", "javascript:alert(1)", "data:text/plain,x"]) {
      expect(parse({ seoSections: [section({ links: [{ label: "A", url }] })] }).success).toBe(false);
    }
  });
  it("enforces text, link and section caps", () => {
    expect(parse({ seoSections: [section({ text: "x".repeat(2000) })] }).success).toBe(true);
    expect(parse({ seoSections: [section({ text: "x".repeat(2001) })] }).success).toBe(false);
    expect(parse({ seoSections: [section({ links: many(40, (i) => ({ label: `L${i}`, url: "/a" })) })] }).success).toBe(true);
    expect(parse({ seoSections: [section({ links: many(41, (i) => ({ label: `L${i}`, url: "/a" })) })] }).success).toBe(false);
    expect(parse({ seoSections: many(12, (i) => section({ id: `s${i}` })) }).success).toBe(true);
    expect(parse({ seoSections: many(13, (i) => section({ id: `s${i}` })) }).success).toBe(false);
  });
});

describe("footer.paymentBadges", () => {
  it("accepts up to 12 badges with safe image urls", () => {
    expect(parse({ paymentBadges: many(12, (i) => ({ id: `p${i}`, label: "Sample", image: "/uploads/x.png" })) }).success).toBe(true);
    expect(parse({ paymentBadges: many(13, (i) => ({ id: `p${i}` })) }).success).toBe(false);
  });
  it("rejects unsafe image urls", () => {
    expect(parse({ paymentBadges: [{ id: "p", image: "javascript:alert(1)" }] }).success).toBe(false);
  });
});

describe("footer.image", () => {
  it("accepts a full valid config", () => {
    const out = parse({ image: { enabled: true, image: "/uploads/a.png", alt: "Sample", linkUrl: "https://example.com", placement: "BOTTOM", maxWidth: 400, showOnMobile: false } });
    expect(out.success).toBe(true);
  });
  it("accepts each placement and rejects others", () => {
    for (const placement of ["TOP", "BRAND", "BOTTOM"]) expect(parse({ image: { placement } }).success).toBe(true);
    expect(parse({ image: { placement: "LEFT" } }).success).toBe(false);
  });
  it("bounds maxWidth to 40-1200 integers", () => {
    expect(parse({ image: { maxWidth: 40 } }).success).toBe(true);
    expect(parse({ image: { maxWidth: 1200 } }).success).toBe(true);
    expect(parse({ image: { maxWidth: 39 } }).success).toBe(false);
    expect(parse({ image: { maxWidth: 1201 } }).success).toBe(false);
    expect(parse({ image: { maxWidth: 400.5 } }).success).toBe(false);
  });
  it("bounds alt to 240 and rejects unsafe link/image urls", () => {
    expect(parse({ image: { alt: "x".repeat(240) } }).success).toBe(true);
    expect(parse({ image: { alt: "x".repeat(241) } }).success).toBe(false);
    expect(parse({ image: { linkUrl: "javascript:alert(1)" } }).success).toBe(false);
    expect(parse({ image: { linkUrl: "tel:+000" } }).success).toBe(false);
    expect(parse({ image: { image: "data:image/png;base64,AAAA" } }).success).toBe(false);
  });
});

describe("footer.footerColumns caps", () => {
  const col = (i) => ({ id: `fc-${i}`, title: "T", links: [{ label: "A", type: "CUSTOM_URL", url: "/a" }] });
  it("allows 8 columns and rejects 9", () => {
    expect(parse({ footerColumns: many(8, col) }).success).toBe(true);
    expect(parse({ footerColumns: many(9, col) }).success).toBe(false);
  });
});

describe("footer.artwork", () => {
  const validArtwork = {
    enabled: true,
    desktopImage: "/uploads/artwork-desktop.jpg",
    mobileImage: "/uploads/artwork-mobile.jpg",
    alt: "Handcrafted folk motifs border",
    isDecorative: false,
    fit: "cover",
    desktopHeight: 340,
    tabletHeight: 280,
    mobileHeight: 220,
    minHeight: 120,
    maxHeight: 600,
    positionPreset: "center",
    positionX: 50,
    positionY: 70,
    offsetX: 5,
    offsetY: -10,
    topSpacing: -15,
    backgroundColor: "#2B2723",
    linkUrl: "/collections/handcrafted-decor",
    openInNewTab: false,
  };

  it("accepts a full valid artwork configuration", () => {
    expect(parse({ artwork: validArtwork }).success).toBe(true);
  });

  it("accepts fit modes: cover, contain, natural and rejects unknown", () => {
    for (const fit of ["cover", "contain", "natural"]) {
      expect(parse({ artwork: { fit } }).success).toBe(true);
    }
    expect(parse({ artwork: { fit: "stretch" } }).success).toBe(false);
  });

  it("accepts position presets and rejects unknown", () => {
    for (const preset of ["center", "top", "bottom", "left", "right", "custom"]) {
      expect(parse({ artwork: { positionPreset: preset } }).success).toBe(true);
    }
    expect(parse({ artwork: { positionPreset: "diagonal" } }).success).toBe(false);
  });

  it("bounds focal position percentages to 0-100", () => {
    expect(parse({ artwork: { positionX: 0, positionY: 100 } }).success).toBe(true);
    expect(parse({ artwork: { positionX: -1 } }).success).toBe(false);
    expect(parse({ artwork: { positionX: 101 } }).success).toBe(false);
    expect(parse({ artwork: { positionY: -5 } }).success).toBe(false);
    expect(parse({ artwork: { positionY: 105 } }).success).toBe(false);
  });

  it("bounds visual offsets to -20px to +20px", () => {
    expect(parse({ artwork: { offsetX: -20, offsetY: 20 } }).success).toBe(true);
    expect(parse({ artwork: { offsetX: -21 } }).success).toBe(false);
    expect(parse({ artwork: { offsetX: 21 } }).success).toBe(false);
    expect(parse({ artwork: { offsetY: -21 } }).success).toBe(false);
    expect(parse({ artwork: { offsetY: 21 } }).success).toBe(false);
  });

  it("bounds topSpacing to -40px to +40px", () => {
    expect(parse({ artwork: { topSpacing: -40 } }).success).toBe(true);
    expect(parse({ artwork: { topSpacing: 40 } }).success).toBe(true);
    expect(parse({ artwork: { topSpacing: -41 } }).success).toBe(false);
    expect(parse({ artwork: { topSpacing: 41 } }).success).toBe(false);
  });

  it("bounds responsive heights to safe ranges", () => {
    expect(parse({ artwork: { desktopHeight: 40, tabletHeight: 40, mobileHeight: 40 } }).success).toBe(true);
    expect(parse({ artwork: { desktopHeight: 1200, tabletHeight: 1000, mobileHeight: 800 } }).success).toBe(true);
    expect(parse({ artwork: { desktopHeight: 39 } }).success).toBe(false);
    expect(parse({ artwork: { desktopHeight: 1201 } }).success).toBe(false);
    expect(parse({ artwork: { tabletHeight: 1001 } }).success).toBe(false);
    expect(parse({ artwork: { mobileHeight: 801 } }).success).toBe(false);
  });

  it("bounds alt to 240 chars and rejects unsafe image/link URLs", () => {
    expect(parse({ artwork: { alt: "x".repeat(240) } }).success).toBe(true);
    expect(parse({ artwork: { alt: "x".repeat(241) } }).success).toBe(false);
    expect(parse({ artwork: { desktopImage: "javascript:alert(1)" } }).success).toBe(false);
    expect(parse({ artwork: { mobileImage: "data:image/svg+xml,<svg></svg>" } }).success).toBe(false);
    expect(parse({ artwork: { linkUrl: "javascript:alert(1)" } }).success).toBe(false);
    expect(parse({ artwork: { linkUrl: "tel:+123" } }).success).toBe(false);
  });

  it("allows null or empty values for optional fields", () => {
    expect(parse({
      artwork: {
        enabled: false,
        desktopImage: null,
        mobileImage: "",
        alt: "",
        desktopHeight: null,
        tabletHeight: null,
        mobileHeight: null,
        minHeight: null,
        maxHeight: null,
        positionX: null,
        positionY: null,
        offsetX: null,
        offsetY: null,
        topSpacing: null,
        backgroundColor: null,
        linkUrl: null,
      }
    }).success).toBe(true);
  });
});
