import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import fs from "node:fs";
import path from "node:path";
import { SYSTEM_PAGES, isSystemPageSlug, publicPagePath } from "../src/lib/systemPages";

let mockSettings;
const mockFetchPage = vi.fn();
const mockAdminList = vi.fn();
vi.mock("../src/hooks/useSiteSettings", () => ({ useSiteSettings: () => mockSettings }));
vi.mock("../src/lib/api", () => ({
  fetchPageBySlug: (...a) => mockFetchPage(...a),
  resolveProductImageUrl: (u) => u || null,
  resolveMediaUrl: (u) => u || null,
  adminListPages: (...a) => mockAdminList(...a),
  adminCreatePage: vi.fn(), adminUpdatePage: vi.fn(), adminDeletePage: vi.fn(), adminPublishPage: vi.fn(),
}));
vi.mock("../src/components/cms/RichTextEditor", () => ({ default: () => <div data-testid="rte" /> }));
vi.mock("../src/components/admin/ImagePickerInput", () => ({ default: () => <div data-testid="img-picker" /> }));

const SystemPage = (await import("../src/pages/SystemPage")).default;
const Contact = (await import("../src/pages/Contact")).default;
const AdminPages = (await import("../src/pages/admin/AdminPages")).default;

const LEGACY = /Dr.s?Aqsa|bAadyab|Research Thinkpod/;
const page = (slug, name, content, extra = {}) => ({ data: { slug, name, content, excerpt: "", featuredImage: null, ...extra } });
const notFound = () => Object.assign(new Error("not found"), { status: 404 });
const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => {
  mockFetchPage.mockReset(); mockAdminList.mockReset();
  mockSettings = {
    general: { storeName: "Tushaqsa", businessAddress: "12 Demo Street", city: "Jaipur", state: "Rajasthan", country: "India" },
    supportEmail: "help@aadya.example", supportPhone: "+91 90000 00000",
    shipping: { freeShippingThreshold: 2499 }, returns: { enabled: true, windowDays: 7 },
  };
});

describe("Contact page", () => {
  it("renders CMS title, intro and body, with SEO title from the page", async () => {
    mockFetchPage.mockResolvedValue(page("contact", "Contact Us", "<p>Write to us about an order.</p>", { excerpt: "We are happy to help.", seoTitle: "Reach Tushaqsa" }));
    wrap(<Contact />);
    expect(await screen.findByRole("heading", { level: 1, name: "Contact Us" })).toBeInTheDocument();
    expect(screen.getByText("Write to us about an order.")).toBeInTheDocument();
    expect(screen.getByText("We are happy to help.")).toBeInTheDocument();
    expect(mockFetchPage).toHaveBeenCalledWith("contact");
    expect(document.title || document.querySelector("title")?.textContent).toMatch(/Reach Tushaqsa/);
  });

  it("shows contact details from Store Settings (single source), and only configured ones", async () => {
    mockFetchPage.mockResolvedValue(page("contact", "Contact Us", "<p>Hi</p>"));
    wrap(<Contact />);
    const details = await screen.findByTestId("contact-details");
    expect(within(details).getByText("help@aadya.example")).toBeInTheDocument();
    expect(within(details).getByText("+91 90000 00000")).toBeInTheDocument();
    expect(within(details).getByText("12 Demo Street, Jaipur, Rajasthan, India")).toBeInTheDocument();
  });

  it("hides the details block when nothing is configured (no 'to be added' filler)", async () => {
    mockSettings = { general: { storeName: "Tushaqsa" }, shipping: {}, returns: {} };
    mockFetchPage.mockResolvedValue(page("contact", "Contact Us", "<p>Hi</p>"));
    wrap(<Contact />);
    await screen.findByRole("heading", { level: 1, name: "Contact Us" });
    expect(screen.queryByTestId("contact-details")).toBeNull();
    expect(screen.queryByText(/to be added/i)).toBeNull();
  });

  it("does not show an enquiry form (the store has no endpoint to receive one)", async () => {
    mockFetchPage.mockResolvedValue(page("contact", "Contact Us", "<p>Hi</p>"));
    wrap(<Contact />);
    await screen.findByRole("heading", { level: 1, name: "Contact Us" });
    expect(screen.queryByTestId("contact-form")).toBeNull();
    expect(document.body.textContent).not.toMatch(/demo enquiry/i);
  });

  it("uses a safe fallback when the CMS page is missing/unpublished", async () => {
    mockFetchPage.mockRejectedValue(notFound());
    wrap(<Contact />);
    expect(await screen.findByTestId("system-page-fallback")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Contact Us" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(LEGACY);
  });
});

describe("optional pages: training / consultation / research / events / thinkpod", () => {
  const SLUGS = ["training", "consultation", "research", "events", "thinkpod"];
  const renderOptional = (slug) => wrap(<SystemPage slug={slug} eyebrow={slug} missing="notfound" />);

  it.each(SLUGS)("%s renders its CMS content when published", async (slug) => {
    mockFetchPage.mockResolvedValue(page(slug, `${slug} page title`, `<p>Body copy for ${slug}.</p>`));
    renderOptional(slug);
    expect(await screen.findByRole("heading", { level: 1, name: `${slug} page title` })).toBeInTheDocument();
    expect(screen.getByText(`Body copy for ${slug}.`)).toBeInTheDocument();
    expect(mockFetchPage).toHaveBeenCalledWith(slug);
  });

  it.each(SLUGS)("%s is a normal 404 (no stale static content) when unpublished or missing", async (slug) => {
    mockFetchPage.mockRejectedValue(notFound());
    renderOptional(slug);
    expect(await screen.findByText("Page Not Found")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(LEGACY);
    expect(screen.queryByTestId("system-page")).toBeNull();
  });

  it("reflects an Admin edit without any code change (new title/body on next load)", async () => {
    mockFetchPage.mockResolvedValueOnce(page("events", "Events", "<p>Version one.</p>"));
    const first = renderOptional("events");
    expect(await screen.findByText("Version one.")).toBeInTheDocument();
    first.unmount();
    mockFetchPage.mockResolvedValueOnce(page("events", "Open Studio Day", "<p>Version two.</p>"));
    renderOptional("events");
    expect(await screen.findByRole("heading", { level: 1, name: "Open Studio Day" })).toBeInTheDocument();
    expect(screen.getByText("Version two.")).toBeInTheDocument();
  });
});

describe("routes and legacy content", () => {
  const src = (p) => fs.readFileSync(path.join(__dirname, "..", "src", p), "utf8");

  it("every system page has a fixed route and the lookup helpers agree", () => {
    expect(Object.keys(SYSTEM_PAGES).sort()).toEqual(["about", "cancellation", "consultation", "contact", "events", "gifting", "payments", "privacy", "research", "returns", "shipping", "terms", "thinkpod", "training"]);
    expect(isSystemPageSlug("contact")).toBe(true);
    expect(isSystemPageSlug("summer-lookbook")).toBe(false);
    expect(publicPagePath("thinkpod")).toBe("/thinkpod");
    expect(publicPagePath("summer-lookbook")).toBe("/pages/summer-lookbook");
  });

  it("App routes the six paths to the CMS: optional pages 404 when unpublished, no legacy page components", () => {
    const app = src("App.jsx");
    for (const slug of ["training", "consultation", "research", "events", "thinkpod"]) {
      expect(app).toContain(`path="/${slug}" element={<SystemPage slug="${slug}"`);
      expect(app).toMatch(new RegExp(`slug="${slug}"[^>]*missing="notfound"`));
    }
    expect(app).toContain('path="/contact" element={<Contact />}');
    expect(app).not.toMatch(/import (Training|ProgramDetail|Consultation|Research|Events|Thinkpod) /);
    expect(app).not.toContain("/training/:slug");
  });

  it("the legacy page components and their static data are gone", () => {
    for (const f of ["pages/Training.jsx", "pages/ProgramDetail.jsx", "pages/Consultation.jsx", "pages/Research.jsx", "pages/Events.jsx", "pages/Thinkpod.jsx", "data/programs.js", "data/consultations.js", "data/events.js", "data/research.js"]) {
      expect(fs.existsSync(path.join(__dirname, "..", "src", f)), f).toBe(false);
    }
  });

  it("no storefront page or component renders the previous brand's names", () => {
    const offenders = [];
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== "admin") walk(p); }
      else if (/\.(jsx?|tsx?)$/.test(e.name) && LEGACY.test(fs.readFileSync(p, "utf8"))) offenders.push(path.relative(path.join(__dirname, ".."), p));
    });
    ["pages", "components", "lib", "hooks"].forEach((d) => walk(path.join(__dirname, "..", "src", d)));
    expect(offenders).toEqual([]);
  });
});

describe("Admin → Pages treats system pages as system pages", () => {
  const rows = [
    { id: "1", name: "Contact Us", slug: "contact", pageType: "STANDARD", status: "PUBLISHED", updatedAt: "2026-10-13T00:00:00Z" },
    { id: "2", name: "Training", slug: "training", pageType: "STANDARD", status: "DRAFT", updatedAt: "2026-10-13T00:00:00Z" },
    { id: "3", name: "Summer Lookbook", slug: "summer-lookbook", pageType: "STANDARD", status: "DRAFT", updatedAt: "2026-10-13T00:00:00Z" },
  ];

  it("shows the real route + System badge, hides Delete for system pages only, and locks the slug", async () => {
    mockAdminList.mockResolvedValue({ data: rows });
    render(<MemoryRouter><AdminPages /></MemoryRouter>);
    const contactRow = (await screen.findByText("Contact Us")).closest("tr");
    expect(within(contactRow).getByText("/contact")).toBeInTheDocument();
    expect(within(contactRow).getByText("System")).toBeInTheDocument();
    expect(within(contactRow).queryByRole("button", { name: "Delete" })).toBeNull();
    const trainingRow = screen.getByText("Training").closest("tr");
    expect(within(trainingRow).getByText("DRAFT")).toBeInTheDocument();
    expect(within(trainingRow).getByRole("button", { name: "Publish" })).toBeInTheDocument();
    expect(within(trainingRow).queryByRole("button", { name: "Delete" })).toBeNull();
    const lookbookRow = screen.getByText("Summer Lookbook").closest("tr");
    expect(within(lookbookRow).getByText("/pages/summer-lookbook")).toBeInTheDocument();
    expect(within(lookbookRow).queryByText("System")).toBeNull();
    expect(within(lookbookRow).getByRole("button", { name: "Delete" })).toBeInTheDocument();

    fireEvent.click(within(contactRow).getByRole("button", { name: "Edit" }));
    await waitFor(() => expect(screen.getByDisplayValue("contact")).toBeDisabled());
  });
});
