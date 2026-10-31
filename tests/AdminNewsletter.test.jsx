import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminNewsletter from "../src/pages/admin/AdminNewsletter";
import { adminListNewsletter, adminDeleteNewsletterSubscriber } from "../src/lib/api";
import { adminNavGroups as ADMIN_NAV } from "../src/components/admin/navConfig";

vi.mock("../src/lib/api", () => ({
  adminListNewsletter: vi.fn(),
  adminDeleteNewsletterSubscriber: vi.fn(),
  adminExportNewsletterCsv: vi.fn(),
}));

const row = (email) => ({ id: email, email, createdAt: "2026-10-01T10:00:00.000Z" });

describe("AdminNewsletter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminListNewsletter.mockResolvedValue({ data: { items: [row("a@x.com"), row("b@x.com")], total: 2, totalAll: 2 } });
  });

  it("lists subscribers with a total count", async () => {
    render(<AdminNewsletter />);
    expect(await screen.findByText("a@x.com")).toBeInTheDocument();
    expect(screen.getByTestId("newsletter-total")).toHaveTextContent("2");
  });

  it("searches by email", async () => {
    render(<AdminNewsletter />);
    await screen.findByText("a@x.com");
    await userEvent.type(screen.getByLabelText(/search by email/i), "b@");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(adminListNewsletter).toHaveBeenLastCalledWith(expect.objectContaining({ q: "b@" })));
  });

  it("removes a subscriber after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    adminDeleteNewsletterSubscriber.mockResolvedValue({});
    render(<AdminNewsletter />);
    await screen.findByText("a@x.com");
    await userEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    expect(adminDeleteNewsletterSubscriber).toHaveBeenCalledWith("a@x.com");
  });

  it("is linked under the Marketing group of the admin nav", () => {
    const marketing = (ADMIN_NAV || []).find((g) => g.title === "Marketing");
    expect(marketing.items.some((i) => i.to === "/admin/newsletter")).toBe(true);
  });
});
