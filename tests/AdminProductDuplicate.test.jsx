import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import AdminProductList from "../src/pages/admin/AdminProductList";
import * as api from "../src/lib/api";

vi.mock("../src/lib/api", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    adminListProducts: vi.fn(),
    adminGetInvoiceSettings: vi.fn().mockResolvedValue({ data: { gstEnabled: false } }),
    adminDuplicateProduct: vi.fn(),
  };
});

describe("AdminProductList Duplicate Action", () => {
  it("renders duplicate button for products and invokes duplicate API", async () => {
    api.adminListProducts.mockResolvedValue({
      data: [
        {
          id: "prod-1",
          name: "Handmade Terracotta Planter",
          sku: "PLANT-01",
          price: 950,
          isActive: true,
          productType: "PHYSICAL",
          stockQuantity: 15,
        },
      ],
      meta: { total: 1, totalPages: 1 },
    });

    api.adminDuplicateProduct.mockResolvedValue({
      success: true,
      data: { id: "prod-copy-1", name: "Handmade Terracotta Planter (Copy)" },
    });

    render(
      <MemoryRouter>
        <AdminProductList />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText("Handmade Terracotta Planter").length).toBeGreaterThan(0);
    });

    const duplicateBtn = screen.getByRole("button", { name: /Duplicate/i });
    expect(duplicateBtn).toBeInTheDocument();

    fireEvent.click(duplicateBtn);

    await waitFor(() => {
      expect(api.adminDuplicateProduct).toHaveBeenCalledWith("prod-1");
    });
  });
});
