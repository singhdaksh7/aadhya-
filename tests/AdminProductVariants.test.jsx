import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminProductForm from "../src/pages/admin/AdminProductForm";
import { toVariantPayload } from "../src/pages/admin/ProductVariantsSection";

const m = {
  list: vi.fn(), create: vi.fn(), update: vi.fn(), del: vi.fn(), getProduct: vi.fn(),
};

vi.mock("../src/lib/api", () => ({
  adminListCategories: () => Promise.resolve({ data: [] }),
  adminGetProduct: (...a) => m.getProduct(...a),
  adminCreateProduct: vi.fn(),
  adminUpdateProduct: vi.fn(),
  adminUploadProductImage: vi.fn(),
  adminDeleteProductImage: vi.fn(),
  adminSetPrimaryImage: vi.fn(),
  adminReorderImages: vi.fn(),
  resolveProductImageUrl: (u) => u,
  adminGetInvoiceSettings: () => Promise.resolve({ data: {} }),
  adminListVariants: (...a) => m.list(...a),
  adminCreateVariant: (...a) => m.create(...a),
  adminUpdateVariant: (...a) => m.update(...a),
  adminDeleteVariant: (...a) => m.del(...a),
}));
vi.mock("../src/components/admin/ImagePickerInput", () => ({ default: () => null }));
vi.mock("../src/components/admin/SpecificationsEditor", () => ({ default: () => null }));
vi.mock("../src/pages/admin/BookFormatsTab", () => ({ default: () => null }));

const product = {
  id: "p1", name: "Lamp", slug: "lamp", productType: "PHYSICAL", categoryId: "", sku: "L1", price: 100, stockQuantity: 5,
  trackInventory: true, isActive: true, specifications: [], tags: [], images: [],
  shipping: { weightKg: 0.4, lengthCm: 28, widthCm: 23, heightCm: 6 },
};
const variant = { id: "v1", name: "Large", sku: "L1-L", stockQuantity: 3, priceOverride: 150, isActive: true, shipping: { weightKg: 0.9, lengthCm: null, widthCm: null, heightCm: null } };

const mount = (path = "/admin/products/p1/edit") => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/admin/products/:id/edit" element={<AdminProductForm />} />
      <Route path="/admin/products/new" element={<AdminProductForm />} />
    </Routes>
  </MemoryRouter>,
);

describe("Admin product variants section", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.getProduct.mockResolvedValue({ data: product });
    m.list.mockResolvedValue({ data: [variant] });
    m.create.mockResolvedValue({ data: {} });
    m.update.mockResolvedValue({ data: {} });
    m.del.mockResolvedValue({});
  });

  it("is not shown when creating a new product", async () => {
    mount("/admin/products/new");
    await screen.findByText(/Shipping & Package Details/);
    expect(screen.queryByTestId("variants-section")).toBeNull();
  });

  it("lists existing variants on an existing product", async () => {
    mount();
    const rows = await screen.findAllByTestId("variant-row");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("Large");
    expect(m.list).toHaveBeenCalledWith("p1");
  });

  it("shows the product's values as placeholders and the inherit hint, and sends blanks as null", async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByTestId("variant-row");
    await user.click(screen.getByRole("button", { name: "Add variant" }));
    expect(screen.getByText("Leave blank to inherit the product's values")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Variant weight kg")).toHaveAttribute("placeholder", "Product: 0.4"));
    expect(screen.getByLabelText("Variant length cm")).toHaveAttribute("placeholder", "Product: 28");
    await user.type(screen.getByLabelText("Variant name"), "Small");
    await user.type(screen.getByLabelText("Variant SKU"), "L1-S");
    await user.type(screen.getByLabelText("Variant weight kg"), "0.25");
    await user.click(screen.getAllByRole("button", { name: "Add variant" }).at(-1));
    await waitFor(() => expect(m.create).toHaveBeenCalled());
    expect(m.create).toHaveBeenCalledWith("p1", expect.objectContaining({
      name: "Small", sku: "L1-S", stockQuantity: 0, priceOverride: null, isActive: true,
      shipping: { weightKg: 0.25, lengthCm: null, widthCm: null, heightCm: null },
    }));
  });

  it("edits a variant: loads its shipping and clearing a field sends null", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Variant weight kg")).toHaveValue("0.9");
    await user.clear(screen.getByLabelText("Variant weight kg"));
    await user.click(screen.getByRole("button", { name: "Save variant" }));
    await waitFor(() => expect(m.update).toHaveBeenCalled());
    expect(m.update.mock.calls[0][0]).toBe("p1");
    expect(m.update.mock.calls[0][1]).toBe("v1");
    expect(m.update.mock.calls[0][2].shipping).toEqual({ weightKg: null, lengthCm: null, widthCm: null, heightCm: null });
    expect(m.update.mock.calls[0][2].priceOverride).toBe(150);
  });

  it("deletes after confirmation only", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    mount();
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    expect(m.del).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(m.del).toHaveBeenCalledWith("p1", "v1"));
    confirm.mockRestore();
  });

  it("requires name and SKU and surfaces API errors", async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByTestId("variant-row");
    await user.click(screen.getByRole("button", { name: "Add variant" }));
    await user.click(screen.getAllByRole("button", { name: "Add variant" }).at(-1));
    expect(await screen.findByRole("alert")).toHaveTextContent("name and SKU are required");
    expect(m.create).not.toHaveBeenCalled();
    m.create.mockRejectedValueOnce(new Error("Variant SKU is already in use"));
    await user.type(screen.getByLabelText("Variant name"), "X");
    await user.type(screen.getByLabelText("Variant SKU"), "DUP");
    await user.click(screen.getAllByRole("button", { name: "Add variant" }).at(-1));
    expect(await screen.findByRole("alert")).toHaveTextContent("already in use");
  });

  it("toVariantPayload converts strings to numbers and blanks to null", () => {
    expect(toVariantPayload({ name: " A ", sku: " S ", stockQuantity: "", priceOverride: "", isActive: false, weightKg: "1.5", lengthCm: "", widthCm: "3", heightCm: "" }))
      .toEqual({ name: "A", sku: "S", stockQuantity: 0, priceOverride: null, isActive: false, shipping: { weightKg: 1.5, lengthCm: null, widthCm: 3, heightCm: null } });
  });
});
