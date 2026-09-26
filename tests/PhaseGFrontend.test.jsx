import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import React from "react";

import { CustomerAuthProvider } from "../src/context/CustomerAuthContext";
import { WishlistProvider } from "../src/context/WishlistContext";
import { CartProvider } from "../src/context/CartContext";
import ProductReviews from "../src/components/ProductReviews";
import ProductCard from "../src/components/ProductCard";
import { AccountWishlist, AccountReviews, Account } from "../src/pages/account/AccountPages";
import AdminReviews from "../src/pages/admin/AdminReviews";

const mockApi = vi.hoisted(() => ({
  fetchProductReviews: vi.fn(),
  submitProductReview: vi.fn(),
  fetchCustomerReviews: vi.fn(),
  updateCustomerReview: vi.fn(),
  deleteCustomerReview: vi.fn(),
  adminListReviews: vi.fn(),
  adminUpdateReviewStatus: vi.fn(),
  adminDeleteReview: vi.fn(),
  fetchWishlist: vi.fn(),
  addToWishlist: vi.fn(),
  removeFromWishlist: vi.fn(),
  customerRefresh: vi.fn(),
  customerLogout: vi.fn(),
  accountOrders: vi.fn(),
  accountAddresses: vi.fn(),
  setAccessToken: vi.fn(),
  addServerCartItem: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("../src/lib/api", () => mockApi);
vi.mock("../src/hooks/useSiteSettings", () => ({
  useSiteSettings: () => ({ showRatings: true, promoStrip: null }),
}));

const SAMPLE_PRODUCT = {
  id: "p1",
  slug: "ceramic-vase",
  name: "Handcrafted Ceramic Vase",
  price: 1500,
  salePrice: 1200,
  inStock: true,
  stockQuantity: 10,
  images: ["https://example.com/vase.jpg"],
  category: "Home Decor",
  categorySlug: "home-decor",
  reviewCount: 2,
  averageRating: 4.5,
};

const SAMPLE_REVIEWS = [
  {
    id: "r1",
    productId: "p1",
    rating: 5,
    title: "Exquisite Craftsmanship",
    comment: "This vase adds so much warmth to my study room.",
    status: "APPROVED",
    isVerifiedPurchase: true,
    createdAt: new Date().toISOString(),
    customer: { name: "Ananya Sharma" },
    product: { id: "p1", name: "Handcrafted Ceramic Vase", slug: "ceramic-vase" },
  },
  {
    id: "r2",
    productId: "p1",
    rating: 4,
    title: "Lovely Texture",
    comment: "Beautiful matte texture, quick delivery.",
    status: "APPROVED",
    isVerifiedPurchase: false,
    createdAt: new Date().toISOString(),
    customer: { name: "Rahul Verma" },
    product: { id: "p1", name: "Handcrafted Ceramic Vase", slug: "ceramic-vase" },
  },
];

const CUSTOMER = { id: "c1", name: "Ananya Sharma", email: "ananya@example.com" };

describe("Phase G Frontend Tests", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockApi.customerRefresh.mockResolvedValue({ data: { customer: CUSTOMER, accessToken: "tok1" } });
    mockApi.fetchProductReviews.mockResolvedValue({
      data: SAMPLE_REVIEWS,
      pagination: { total: 2, pages: 1 },
      summary: { averageRating: 4.5, reviewCount: 2, ratingBreakdown: { 5: 1, 4: 1, 3: 0, 2: 0, 1: 0 } },
    });
    mockApi.fetchWishlist.mockResolvedValue({
      data: [{ id: "w1", productId: "p1", product: SAMPLE_PRODUCT }],
    });
    mockApi.fetchCustomerReviews.mockResolvedValue({ data: SAMPLE_REVIEWS });
    mockApi.accountOrders.mockResolvedValue({ data: [] });
    mockApi.accountAddresses.mockResolvedValue({ data: [] });
  });

  describe("ProductReviews Component", () => {
    it("renders reviews rating summary and approved reviews", async () => {
      render(
        <MemoryRouter>
          <CustomerAuthProvider>
            <ProductReviews productId="p1" />
          </CustomerAuthProvider>
        </MemoryRouter>
      );

      expect(await screen.findByText(/Customer Reviews/i)).toBeInTheDocument();
      expect(screen.getByText("Exquisite Craftsmanship")).toBeInTheDocument();
      expect(screen.getByText("Lovely Texture")).toBeInTheDocument();
      expect(screen.getAllByText(/Verified Buyer/i)[0]).toBeInTheDocument();
    });

    it("shows sign-in prompt when unauthenticated user tries to write a review", async () => {
      mockApi.customerRefresh.mockRejectedValue(new Error("Unauthenticated"));

      render(
        <MemoryRouter>
          <CustomerAuthProvider>
            <ProductReviews productId="p1" />
          </CustomerAuthProvider>
        </MemoryRouter>
      );

      expect(await screen.findByText(/Customer Reviews/i)).toBeInTheDocument();
      expect(screen.getByText(/Please sign in to write a product review/i)).toBeInTheDocument();
    });

    it("allows logged-in user to submit a new review", async () => {
      mockApi.customerRefresh.mockResolvedValue({ data: { customer: CUSTOMER, accessToken: "tok1" } });
      mockApi.fetchCustomerReviews.mockResolvedValue({ data: [] });
      mockApi.submitProductReview.mockResolvedValue({
        data: { id: "r3", status: "PENDING", rating: 5, title: "Great", comment: "Awesome vase" },
      });

      render(
        <MemoryRouter>
          <CustomerAuthProvider>
            <ProductReviews productId="p1" />
          </CustomerAuthProvider>
        </MemoryRouter>
      );

      expect(await screen.findByText(/Customer Reviews/i)).toBeInTheDocument();

      const writeBtn = await screen.findByRole("button", { name: /Write a Review/i });
      await userEvent.click(writeBtn);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/e\.g\. Beautiful slow craftsmanship/i)).toBeInTheDocument();
      });

      await userEvent.type(screen.getByPlaceholderText(/e\.g\. Beautiful slow craftsmanship/i), "Great Vase");
      await userEvent.type(screen.getByPlaceholderText(/Share details/i), "Awesome quality vase!");
      await userEvent.click(screen.getByRole("button", { name: /^Submit Review$/i }));

      expect(mockApi.submitProductReview).toHaveBeenCalledWith({
        productId: "p1",
        rating: 5,
        title: "Great Vase",
        comment: "Awesome quality vase!",
      });
    });
  });

  describe("ProductCard Wishlist Integration", () => {
    it("toggles wishlist state on heart button click", async () => {
      mockApi.fetchWishlist.mockResolvedValue({ data: [] });
      mockApi.addToWishlist.mockResolvedValue({ data: { id: "w1", productId: "p1" } });

      render(
        <MemoryRouter>
          <CustomerAuthProvider>
            <CartProvider>
              <WishlistProvider>
                <ProductCard product={SAMPLE_PRODUCT} />
              </WishlistProvider>
            </CartProvider>
          </CustomerAuthProvider>
        </MemoryRouter>
      );

      const heartBtn = screen.getByRole("button", { name: /Add to Wishlist/i });
      expect(heartBtn).toBeInTheDocument();

      await userEvent.click(heartBtn);
      expect(mockApi.addToWishlist).toHaveBeenCalledWith("p1", null);
    });
  });

  describe("Account Wishlist Page", () => {
    it("renders wishlisted items and handles move to cart", async () => {
      mockApi.fetchWishlist.mockResolvedValue({
        data: [{ id: "w1", productId: "p1", product: SAMPLE_PRODUCT }],
      });

      render(
        <MemoryRouter initialEntries={["/account/wishlist"]}>
          <CustomerAuthProvider>
            <CartProvider>
              <WishlistProvider>
                <AccountWishlist />
              </WishlistProvider>
            </CartProvider>
          </CustomerAuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockApi.fetchWishlist).toHaveBeenCalled();
      });

      expect(await screen.findByText("My Wishlist")).toBeInTheDocument();
      expect(await screen.findByText("Handcrafted Ceramic Vase")).toBeInTheDocument();

      const moveBtn = screen.getByRole("button", { name: /Move to Cart/i });
      await userEvent.click(moveBtn);
    });
  });

  describe("Account Reviews Page", () => {
    it("renders customer reviews and permits editing", async () => {
      mockApi.fetchCustomerReviews.mockResolvedValue({ data: SAMPLE_REVIEWS });
      mockApi.updateCustomerReview.mockResolvedValue({
        data: { ...SAMPLE_REVIEWS[0], status: "PENDING", title: "Updated Title" },
      });

      render(
        <MemoryRouter initialEntries={["/account/reviews"]}>
          <CustomerAuthProvider>
            <AccountReviews />
          </CustomerAuthProvider>
        </MemoryRouter>
      );

      expect(await screen.findByText("My Reviews")).toBeInTheDocument();
      expect(screen.getByText("Exquisite Craftsmanship")).toBeInTheDocument();

      const editBtn = screen.getAllByRole("button", { name: /Edit Review/i })[0];
      await userEvent.click(editBtn);

      const titleInput = screen.getByDisplayValue("Exquisite Craftsmanship");
      await userEvent.clear(titleInput);
      await userEvent.type(titleInput, "Updated Title");

      const saveBtn = screen.getByRole("button", { name: /Save & Submit for Moderation/i });
      await userEvent.click(saveBtn);

      expect(mockApi.updateCustomerReview).toHaveBeenCalledWith("r1", {
        rating: 5,
        title: "Updated Title",
        comment: "This vase adds so much warmth to my study room.",
      });
    });
  });

  describe("Admin Reviews Page", () => {
    it("renders moderation interface and allows approval", async () => {
      mockApi.adminListReviews.mockResolvedValue({
        data: [
          {
            id: "r10",
            rating: 5,
            title: "Pending Review Title",
            comment: "Pending comment text",
            status: "PENDING",
            isVerifiedPurchase: true,
            createdAt: new Date().toISOString(),
            product: { id: "p1", name: "Handcrafted Ceramic Vase", slug: "ceramic-vase" },
            customer: { id: "c1", name: "Ananya Sharma", email: "ananya@example.com" },
          },
        ],
        pagination: { total: 1, pages: 1 },
      });

      mockApi.adminUpdateReviewStatus.mockResolvedValue({
        data: { id: "r10", status: "APPROVED" },
      });

      render(
        <MemoryRouter>
          <AdminReviews />
        </MemoryRouter>
      );

      expect(await screen.findByText("Moderate, approve, and manage customer product reviews.")).toBeInTheDocument();
      expect(screen.getByText("Pending Review Title")).toBeInTheDocument();

      const approveBtn = screen.getByRole("button", { name: /^Approve$/i });
      await userEvent.click(approveBtn);

      expect(mockApi.adminUpdateReviewStatus).toHaveBeenCalledWith("r10", "APPROVED");
    });
  });
});

