import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FooterSectionsEditor from "../src/components/admin/FooterSectionsEditor";
import AdminSettings from "../src/pages/admin/AdminSettings";
import { DEFAULT_SITE_SETTINGS } from "../src/hooks/useSiteSettings";

const adminFetchSiteSettings = vi.fn();
const adminUpdateSiteSettings = vi.fn();
const adminListPages = vi.fn();

vi.mock("../src/lib/api", () => ({
  adminFetchSiteSettings: (...a) => adminFetchSiteSettings(...a),
  adminUpdateSiteSettings: (...a) => adminUpdateSiteSettings(...a),
  adminResetAppearanceSettings: vi.fn(),
  adminListPages: (...a) => adminListPages(...a),
}));

vi.mock("../src/hooks/useSiteSettings", async () => {
  const actual = await vi.importActual("../src/hooks/useSiteSettings");
  return { ...actual, refreshSiteSettings: vi.fn(() => Promise.resolve()) };
});

// Minimal stand-in: a text input that reports a chosen URL.
vi.mock("../src/components/admin/ImagePickerInput", () => ({
  default: ({ label, value, onChange }) => (
    <input aria-label={`picker ${label}`} value={value || ""} onChange={(e) => onChange(e.target.value)} />
  ),
}));

let latest;
function Harness({ initial = {}, pages = [] }) {
  const [footer, setFooter] = useState(initial);
  latest = footer;
  return <FooterSectionsEditor footer={footer} pages={pages} onChange={(patch) => setFooter((f) => ({ ...f, ...patch }))} />;
}

describe("FooterSectionsEditor", () => {
  it("adds, edits, reorders, disables and deletes contact rows", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText("+ Add contact row"));
    await user.click(screen.getByText("+ Add contact row"));
    await user.type(screen.getByLabelText("Contact 1 label"), "Mobile");
    await user.type(screen.getByLabelText("Contact 1 value"), "+00 000 000 0000");
    await user.type(screen.getByLabelText("Contact 2 label"), "Email");
    expect(latest.contactItems).toHaveLength(2);

    await user.click(screen.getByLabelText("Move contact 1 down"));
    expect(latest.contactItems.map((c) => c.label)).toEqual(["Email", "Mobile"]);
    expect(latest.contactItems.map((c) => c.sortOrder)).toEqual([1, 2]);

    await user.click(screen.getByLabelText("Enable contact 1"));
    expect(latest.contactItems[0].enabled).toBe(false);

    await user.click(screen.getByLabelText("Delete contact 1"));
    expect(latest.contactItems.map((c) => c.label)).toEqual(["Mobile"]);
  });

  it("validates contact link schemes client-side", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ contactItems: [{ id: "a", enabled: true, label: "L", value: "V", url: "" }] }} />);
    const url = screen.getByLabelText("Contact 1 link");
    await user.type(url, "javascript:alert(1)");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await user.clear(url);
    await user.type(url, "tel:+000");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("manages company lines with the 10 line cap", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    for (let i = 0; i < 11; i++) {
      const btn = screen.getByText("+ Add line");
      if (btn.disabled) break;
      await user.click(btn);
    }
    expect(latest.companyBlock.lines).toHaveLength(10);
    expect(screen.getByText("+ Add line")).toBeDisabled();
    await user.type(screen.getByLabelText("Company line 1"), "Example Company Pvt Ltd");
    expect(latest.companyBlock.lines[0]).toBe("Example Company Pvt Ltd");
  });

  it("adds, removes, reorders and disables link columns and their links (max 8)", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ footerColumns: [{ id: "c1", title: "One", enabled: true, links: [] }, { id: "c2", title: "Two", enabled: true, links: [] }] }} />);
    await user.click(screen.getByLabelText("Move column 1 down"));
    expect(latest.footerColumns.map((c) => c.title)).toEqual(["Two", "One"]);
    await user.click(screen.getByLabelText("Enable column 1"));
    expect(latest.footerColumns[0].enabled).toBe(false);

    const addLink = screen.getAllByText("+ Add link")[0];
    await user.click(addLink);
    await user.type(screen.getByLabelText("Column 1 link 1 label"), "Terms");
    await user.type(screen.getByLabelText("Column 1 link 1 url"), "/terms");
    expect(latest.footerColumns[0].links[0]).toMatchObject({ label: "Terms", type: "CUSTOM_URL", url: "/terms" });

    for (let i = 0; i < 10; i++) {
      const btn = screen.getByText("+ Add column");
      if (btn.disabled) break;
      await user.click(btn);
    }
    expect(latest.footerColumns).toHaveLength(8);
    await user.click(screen.getByLabelText("Delete column 8"));
    expect(latest.footerColumns).toHaveLength(7);
  });

  it("edits SEO sections and their links", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText("+ Add section"));
    await user.type(screen.getByLabelText("SEO section 1 heading"), "Sample Heading");
    const sec = screen.getByTestId("footer-seo-editor");
    await user.click(within(sec).getByText("+ Add link"));
    await user.click(within(sec).getByText("+ Add link"));
    await user.type(screen.getByLabelText("SEO section 1 link 1 label"), "A");
    await user.type(screen.getByLabelText("SEO section 1 link 1 url"), "/a");
    await user.type(screen.getByLabelText("SEO section 1 link 2 label"), "B");
    await user.click(screen.getByLabelText("Move SEO section 1 link 1 down"));
    expect(latest.seoSections[0].links.map((l) => l.label)).toEqual(["B", "A"]);
    await user.click(screen.getByLabelText("Enable SEO section 1"));
    expect(latest.seoSections[0].enabled).toBe(false);
    await user.click(screen.getByLabelText("Delete SEO section 1 link 1"));
    expect(latest.seoSections[0].links).toHaveLength(1);
  });

  it("manages payment badges and the footer image", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText("+ Add badge"));
    await user.type(screen.getByLabelText("picker Badge image"), "/uploads/pay.png");
    expect(latest.paymentBadges[0].image).toBe("/uploads/pay.png");
    await user.click(screen.getByLabelText("Delete badge 1"));
    expect(latest.paymentBadges).toEqual([]);

    await user.click(screen.getByLabelText(/Show footer image/));
    await user.type(screen.getByLabelText("picker Image"), "/uploads/banner.png");
    await user.type(screen.getByLabelText("Footer image alt text"), "Sample");
    await user.selectOptions(screen.getByLabelText("Footer image placement"), "BOTTOM");
    await user.type(screen.getByLabelText("Footer image max width"), "600");
    await user.click(screen.getByLabelText("Show on mobile"));
    expect(latest.image).toMatchObject({ enabled: true, image: "/uploads/banner.png", alt: "Sample", placement: "BOTTOM", maxWidth: 600, showOnMobile: false });
  });

  it("flags out-of-range image max width", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText("Footer image max width"), "5000");
    expect(screen.getByRole("alert")).toHaveTextContent(/40 and 1200/);
  });
});

describe("Footer tab save flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminFetchSiteSettings.mockResolvedValue({ data: DEFAULT_SITE_SETTINGS });
    adminListPages.mockResolvedValue({ data: [] });
  });

  it("saves new footer keys through Save All Settings and keeps existing footer data", async () => {
    adminUpdateSiteSettings.mockResolvedValue({ data: DEFAULT_SITE_SETTINGS });
    const user = userEvent.setup();
    render(<AdminSettings />);
    await user.click(await screen.findByText("Footer Details"));
    await user.click(screen.getByText("+ Add contact row"));
    await user.type(screen.getByLabelText("Contact 1 label"), "Toll-free");
    await user.type(screen.getByLabelText("Contact 1 value"), "000 000 000");
    await user.click(screen.getByText("Save All Settings"));

    await waitFor(() => expect(adminUpdateSiteSettings).toHaveBeenCalled());
    const payload = adminUpdateSiteSettings.mock.calls[0][0];
    expect(payload.footer.contactItems).toEqual([expect.objectContaining({ label: "Toll-free", value: "000 000 000", enabled: true, sortOrder: 1 })]);
    expect(payload.footer.brandDescription).toBe(DEFAULT_SITE_SETTINGS.footer.brandDescription);
    expect(payload.footer.footerColumns).toHaveLength(DEFAULT_SITE_SETTINGS.footer.footerColumns.length);
    expect(payload.footer.companyBlock).toBeUndefined();
  });

  it("shows a server validation error from the footer save", async () => {
    adminUpdateSiteSettings.mockRejectedValue(new Error("footer.contactItems.0.url: URL must be relative, http(s), tel: or mailto:"));
    const user = userEvent.setup();
    render(<AdminSettings />);
    await user.click(await screen.findByText("Footer Details"));
    await user.click(screen.getByText("Save All Settings"));
    await screen.findByText(/footer\.contactItems\.0\.url/);
  });
});
