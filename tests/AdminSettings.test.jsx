import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminSettings from "../src/pages/admin/AdminSettings";
import { DEFAULT_SITE_SETTINGS } from "../src/hooks/useSiteSettings";

const adminFetchSiteSettings = vi.fn();
const adminUpdateSiteSettings = vi.fn();
const adminResetAppearanceSettings = vi.fn();
const adminListPages = vi.fn();
const refreshSiteSettings = vi.fn(() => Promise.resolve());

vi.mock("../src/lib/api", () => ({
  adminFetchSiteSettings: (...a) => adminFetchSiteSettings(...a),
  adminUpdateSiteSettings: (...a) => adminUpdateSiteSettings(...a),
  adminResetAppearanceSettings: (...a) => adminResetAppearanceSettings(...a),
  adminListPages: (...a) => adminListPages(...a),
}));

vi.mock("../src/hooks/useSiteSettings", async () => {
  const actual = await vi.importActual("../src/hooks/useSiteSettings");
  return { ...actual, refreshSiteSettings: (...a) => refreshSiteSettings(...a) };
});

vi.mock("../src/components/admin/ImagePickerInput", () => ({
  default: () => null,
}));

describe("AdminSettings save behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminFetchSiteSettings.mockResolvedValue({ data: DEFAULT_SITE_SETTINGS });
    adminListPages.mockResolvedValue({ data: [] });
  });

  it("shows a loading state, then success feedback, and refreshes storefront settings after a successful save", async () => {
    adminUpdateSiteSettings.mockResolvedValue({ data: DEFAULT_SITE_SETTINGS });
    const user = userEvent.setup();
    render(<AdminSettings />);

    await screen.findByText("Save All Settings");
    const saveButton = screen.getByText("Save All Settings");
    await user.click(saveButton);

    await waitFor(() => expect(adminUpdateSiteSettings).toHaveBeenCalled());
    await waitFor(() => expect(refreshSiteSettings).toHaveBeenCalled());
    await screen.findByText(/successfully saved/i);
  });

  it("shows useful failure feedback and does not silently swallow a save error", async () => {
    adminUpdateSiteSettings.mockRejectedValue(new Error("Support email must be a valid email address"));
    const user = userEvent.setup();
    render(<AdminSettings />);

    await screen.findByText("Save All Settings");
    await user.click(screen.getByText("Save All Settings"));

    await screen.findByText(/Support email must be a valid email address/);
    expect(refreshSiteSettings).not.toHaveBeenCalled();
  });

  it("edits the footer website credit (on/off, wording, name, link) and saves it", async () => {
    adminFetchSiteSettings.mockResolvedValue({ data: { ...DEFAULT_SITE_SETTINGS, footer: { ...DEFAULT_SITE_SETTINGS.footer, credit: { enabled: true, prefix: "Website by", name: "Digital Clik", url: "", logo: "" } } } });
    adminUpdateSiteSettings.mockResolvedValue({ data: DEFAULT_SITE_SETTINGS });
    const user = userEvent.setup();
    render(<AdminSettings />);
    await user.click(await screen.findByRole("button", { name: "Footer Details" }));
    expect(screen.getByLabelText("Credit name")).toHaveValue("Digital Clik");
    await user.clear(screen.getByLabelText("Credit text"));
    await user.type(screen.getByLabelText("Credit text"), "Crafted by");
    await user.type(screen.getByLabelText("Credit link"), "https://example.com");
    await user.click(screen.getByLabelText("Show website credit"));
    await user.click(screen.getByText("Save All Settings"));
    await waitFor(() => expect(adminUpdateSiteSettings).toHaveBeenCalled());
    expect(adminUpdateSiteSettings.mock.calls[0][0].footer.credit).toMatchObject({ enabled: false, prefix: "Crafted by", name: "Digital Clik", url: "https://example.com" });
  });
});
