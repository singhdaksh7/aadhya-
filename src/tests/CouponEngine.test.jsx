import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { BrowserRouter } from "react-router-dom";
import AdminProductForm from "../pages/admin/AdminProductForm";
import AdminCollections from "../pages/admin/AdminCollections";
import AdminCoupons from "../pages/admin/AdminCoupons";

// Mock API calls
vi.mock("../lib/api", () => ({
  adminListCategories: vi.fn().mockResolvedValue({ data: [] }),
  adminListProducts: vi.fn().mockResolvedValue({ data: [] }),
  adminListCollections: vi.fn().mockResolvedValue({ data: [] }),
  adminListCoupons: vi.fn().mockResolvedValue({
    data: [
      {
        id: "c1",
        code: "TESTCODE",
        name: "Test Coupon",
        discountType: "PERCENTAGE",
        value: 10,
        minimumOrderAmount: 500,
        usageCount: 0,
        status: "ACTIVE",
        isActive: true,
      },
    ],
  }),
  adminGetProduct: vi.fn(),
  adminCreateProduct: vi.fn(),
  adminUpdateProduct: vi.fn(),
  adminCreateCollection: vi.fn(),
  adminUpdateCollection: vi.fn(),
  adminCreateCoupon: vi.fn(),
  adminUpdateCoupon: vi.fn(),
  adminDeleteCoupon: vi.fn(),
  listPublicActiveCoupons: vi.fn().mockResolvedValue({ data: [] }),
  validateCouponCode: vi.fn(),
  resolveProductImageUrl: (url) => url,
}));

describe("Phase D Frontend Components", () => {
  it("renders AdminProductForm with tabbed navigation", async () => {
    render(
      <BrowserRouter>
        <AdminProductForm />
      </BrowserRouter>
    );

    expect(screen.getByText("Add Product")).toBeInTheDocument();
    expect(screen.getByText("Basic")).toBeInTheDocument();
    expect(screen.getByText("Pricing")).toBeInTheDocument();
    expect(screen.getByText("Inventory")).toBeInTheDocument();
    expect(screen.getByText("Media")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(screen.getByText("Flags")).toBeInTheDocument();
    expect(screen.getByText("SEO")).toBeInTheDocument();

    // Switch to Pricing tab
    fireEvent.click(screen.getByText("Pricing"));
    expect(screen.getByText(/Selling Price/i)).toBeInTheDocument();
    expect(screen.getByText(/Cost Price/i)).toBeInTheDocument();
  });

  it("renders AdminCollections with collection types selector", async () => {
    render(
      <BrowserRouter>
        <AdminCollections />
      </BrowserRouter>
    );

    expect(screen.getByText("Collections")).toBeInTheDocument();
    expect(screen.getByText("Collection Type")).toBeInTheDocument();
  });

  it("renders AdminCoupons with coupon list and form", async () => {
    render(
      <BrowserRouter>
        <AdminCoupons />
      </BrowserRouter>
    );

    expect(screen.getByText("Coupons & Offers")).toBeInTheDocument();
    expect(screen.getByText("Coupon Code")).toBeInTheDocument();
    expect(await screen.findByText("TESTCODE")).toBeInTheDocument();
  });
});
