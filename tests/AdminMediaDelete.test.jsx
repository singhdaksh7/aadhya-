import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminMedia from "../src/pages/admin/AdminMedia";
import { ApiRequestError } from "../src/lib/api";

const m = { list: vi.fn(), del: vi.fn() };
vi.mock("../src/lib/api", async (orig) => ({
  ...(await orig()),
  adminListMedia: (...a) => m.list(...a),
  adminDeleteMedia: (...a) => m.del(...a),
  adminUploadMedia: vi.fn(),
  adminUpdateMedia: vi.fn(),
  resolveProductImageUrl: (u) => u,
}));

const asset = { id: "a1", fileName: "x.jpg", originalName: "x.jpg", url: "/uploads/products/x.jpg", mimeType: "image/jpeg", size: 10, altText: "", title: "" };

describe("Media Library delete conflict", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.list.mockResolvedValue({ items: [asset] });
  });

  it("shows the in-use message and never offers force delete for product references", async () => {
    const confirm = vi.spyOn(window, "confirm");
    m.del.mockRejectedValue(new ApiRequestError("This image is currently used by 3 products and cannot be deleted.", 409, { productCount: 3 }));
    render(<AdminMedia />);
    await userEvent.click(await screen.findByRole("img"));
    await userEvent.click(await screen.findByRole("button", { name: /Delete Asset/i }));
    expect(await screen.findByText(/used by 3 products and cannot be deleted/)).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
    expect(m.del).toHaveBeenCalledTimes(1);
    expect(m.del).toHaveBeenCalledWith("a1", false);
  });

  it("still offers force delete for CMS-content conflicts", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    m.del.mockRejectedValue(new ApiRequestError("referenced in CMS", 409, undefined));
    render(<AdminMedia />);
    await userEvent.click(await screen.findByRole("img"));
    await userEvent.click(await screen.findByRole("button", { name: /Delete Asset/i }));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
  });
});
