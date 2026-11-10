import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminProductForm from "../src/pages/admin/AdminProductForm";

const m = { get: vi.fn(), update: vi.fn() };

vi.mock("../src/lib/api", () => ({
  adminListCategories: () => Promise.resolve({ data: [{ id: "c1", name: "Brass", isActive: true }] }),
  adminGetProduct: (...a) => m.get(...a),
  adminCreateProduct: vi.fn(),
  adminUpdateProduct: (...a) => m.update(...a),
  adminDuplicateProduct: vi.fn(),
  adminUploadProductImage: vi.fn(),
  adminDeleteProductImage: vi.fn(),
  adminSetPrimaryImage: vi.fn(),
  adminReorderImages: vi.fn(),
  resolveProductImageUrl: (u) => `resolved:${u}`,
  adminGetInvoiceSettings: () => Promise.resolve({ data: {} }),
  adminListVariants: () => Promise.resolve({ data: [] }),
  adminCreateVariant: vi.fn(), adminUpdateVariant: vi.fn(), adminDeleteVariant: vi.fn(),
}));
vi.mock("../src/components/admin/ImagePickerInput", () => ({ default: () => null }));
vi.mock("../src/components/admin/SpecificationsEditor", () => ({ default: () => null }));
vi.mock("../src/pages/admin/BookFormatsTab", () => ({ default: () => null }));

// Shape returned by POST /admin/products/:id/duplicate then GET /admin/products/:id
const duplicated = {
  id: "dup1", name: "Lamp (Copy)", slug: "lamp-copy", productType: "PHYSICAL", categoryId: "c1", sku: "L1-COPY",
  price: 100, stockQuantity: 0, trackInventory: true, isActive: false, specifications: [], tags: [],
  shipping: { weightKg: null, lengthCm: null, widthCm: null, heightCm: null },
  images: [
    { id: "i1", productId: "dup1", url: "/uploads/products/a.jpg", altText: "A", sortOrder: 0, isPrimary: true },
    { id: "i2", productId: "dup1", url: "/uploads/products/b.jpg", altText: "B", sortOrder: 1, isPrimary: false },
    { id: "i3", productId: "dup1", url: "/uploads/products/c.jpg", altText: "C", sortOrder: 2, isPrimary: false },
  ],
};

const mount = () => render(
  <MemoryRouter initialEntries={["/admin/products/dup1/edit"]}>
    <Routes>
      <Route path="/admin/products/:id/edit" element={<AdminProductForm />} />
      <Route path="/admin/products" element={<div>list</div>} />
    </Routes>
  </MemoryRouter>,
);

describe("Edit form for a duplicated product", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.get.mockResolvedValue({ data: duplicated });
    m.update.mockResolvedValue({ data: duplicated });
  });

  it("shows every cloned image, in order, via the shared resolver (no broken fallback)", async () => {
    mount();
    await waitFor(() => expect(document.querySelectorAll('img[src^="resolved:"]').length).toBe(3));
    const srcs = [...document.querySelectorAll('img[src^="resolved:"]')].map((i) => i.getAttribute("src"));
    expect(srcs).toEqual(["resolved:/uploads/products/a.jpg", "resolved:/uploads/products/b.jpg", "resolved:/uploads/products/c.jpg"]);
  });

  it("title-only save never sends an images key, so images cannot be wiped", async () => {
    mount();
    await waitFor(() => expect(document.querySelectorAll('img[src^="resolved:"]').length).toBe(3));
    const name = screen.getAllByRole("textbox").find((el) => el.value === "Lamp (Copy)");
    await userEvent.clear(name);
    await userEvent.type(name, "Lamp Two");
    await userEvent.click(screen.getByRole("button", { name: /Save Changes/i }));
    await waitFor(() => expect(m.update).toHaveBeenCalled());
    const [id, payload] = m.update.mock.calls[0];
    expect(id).toBe("dup1");
    expect(payload.name).toBe("Lamp Two");
    expect(payload).not.toHaveProperty("images");
  });
});
