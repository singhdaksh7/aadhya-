import { Router } from "express";
import { ok } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import authRoutes from "../modules/auth/auth.routes.js";
import { authRouter, profileRouter } from "../modules/customer-auth/customer-auth.routes.js";
import { accountRouter } from "../modules/account/account.routes.js";
import cartRouter from "../modules/cart/cart.routes.js";
import { publicCategoryRouter, adminCategoryRouter } from "../modules/categories/category.routes.js";
import { publicProductRouter, adminProductRouter } from "../modules/products/product.routes.js";
import * as productService from "../modules/products/product.service.js";
import { listProductsQuerySchema } from "../modules/products/product.validators.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { prisma } from "../lib/prisma.js";
import { checkoutRouter, publicOrderRouter, adminOrderRouter } from "../modules/orders/order.routes.js";
import { orderPaymentRouter, razorpayVerifyRouter } from "../modules/payments/payment.routes.js";
import { getOrderDashboardStats } from "../modules/orders/order.service.js";
import { publicCollectionRouter, adminCollectionRouter } from "../modules/collections/collection.routes.js";
import { publicSettingsRouter, adminSettingsRouter } from "../modules/settings/settings.routes.js";
import { newsletterRouter } from "../modules/newsletter/newsletter.routes.js";
import adminCustomerRouter from "../modules/admin-customers/admin-customers.routes.js";
import adminUserRouter from "../modules/admin-users/admin-users.routes.js";
import navigationRouter from "../modules/navigation/navigation.routes.js";
import { publicPagesRouter, adminPagesRouter } from "../modules/pages/pages.routes.js";
import { publicBannersRouter, adminBannersRouter } from "../modules/banners/banners.routes.js";
import { publicPromosRouter, adminPromosRouter } from "../modules/promos/promos.routes.js";
import { publicCouponRouter, adminCouponRouter } from "../modules/coupons/coupon.routes.js";
import { publicPageRouter, adminPageRouter } from "../modules/pages/page.routes.js";
import { publicBlogRouter, adminBlogRouter } from "../modules/blog/blog.routes.js";
import { publicFaqRouter, adminFaqRouter } from "../modules/faq/faq.routes.js";
import { adminMediaRouter } from "../modules/media/media.routes.js";
import { publicReviewRouter, customerReviewRouter, adminReviewRouter } from "../modules/reviews/review.routes.js";
import wishlistRouter from "../modules/wishlist/wishlist.routes.js";
import notificationRouter from "../modules/notifications/notification.routes.js";
import { publicAnalyticsRouter, adminAnalyticsRouter } from "../modules/analytics/analytics.routes.js";
import { publicSearchRouter } from "../modules/search/search.routes.js";
import { adminShippingRouter } from "../modules/shipping/shipping.routes.js";
import { publicDownloadRouter, customerDownloadRouter, guestDownloadRouter } from "../modules/downloads/download.routes.js";
import { customerInvoiceRouter, guestInvoiceRouter, adminInvoiceRouter } from "../modules/invoices/invoice.routes.js";
import { adminIntegrationRouter } from "../modules/integrations/integration.routes.js";

const router = Router();

router.get("/health", (req, res) => ok(res, { status: "ok" }));

// Public storefront APIs.
router.use("/products/:productId/reviews", publicReviewRouter);
router.use("/products", publicProductRouter);
router.use("/categories", publicCategoryRouter);
router.use("/collections", publicCollectionRouter);
router.use("/coupons", publicCouponRouter);
router.use("/settings", publicSettingsRouter);
router.use("/newsletter", newsletterRouter);
router.use("/navigation", navigationRouter);
router.use("/banners", publicBannersRouter);
router.use("/promos", publicPromosRouter);
router.use("/search", publicSearchRouter);
router.use("/analytics", publicAnalyticsRouter);

// Pages APIs: Specific /home route BEFORE parameterized /:slug route!
router.use("/pages", publicPagesRouter);
router.use("/pages", publicPageRouter);

// Phase E CMS Public APIs
router.use("/blog", publicBlogRouter);
router.use("/faqs", publicFaqRouter);

// Thin convenience wrapper — Books are Products with productType=BOOK,
// this must never grow its own product/business logic (see product.service.js).
router.get(
  "/books",
  asyncHandler(async (req, res) => {
    const query = listProductsQuerySchema.parse({ ...req.query, productType: "BOOK" });
    const { items, meta } = await productService.listPublicProducts(query);
    ok(res, items, meta);
  })
);

// Checkout / orders / payments (public — see individual routers for
// per-route rate limiting; order lookup routes never trust a client price).
router.use("/checkout", checkoutRouter);
router.use("/orders", publicOrderRouter);
router.use("/orders", orderPaymentRouter);
router.use("/auth", authRouter);
router.use("/account/reviews", customerReviewRouter);
router.use("/account/wishlist", wishlistRouter);
router.use("/account/notifications", notificationRouter);
router.use("/account", profileRouter);
router.use("/account", accountRouter);
router.use("/cart", cartRouter);
router.use("/payments/razorpay", razorpayVerifyRouter);
router.use("/downloads", publicDownloadRouter);
router.use("/account/downloads", customerDownloadRouter);
router.use("/orders/downloads", guestDownloadRouter);
router.use("/account/invoices", customerInvoiceRouter);
router.use("/orders/invoices", guestInvoiceRouter);
// POST /api/webhooks/razorpay is mounted directly on the app in app.js,
// ahead of express.json(), because signature verification needs the raw body.

// Admin APIs.
router.use("/admin/auth", authRoutes);
router.use("/admin/categories", adminCategoryRouter);
router.use("/admin/products", adminProductRouter);
router.use("/admin/orders", adminOrderRouter);
router.use("/admin/collections", adminCollectionRouter);
router.use("/admin/coupons", adminCouponRouter);
router.use("/admin/settings", adminSettingsRouter);
router.use("/admin/customers", adminCustomerRouter);
router.use("/admin/admin-users", adminUserRouter);
router.use("/admin/banners", adminBannersRouter);
router.use("/admin/promos", adminPromosRouter);
router.use("/admin/reviews", adminReviewRouter);
router.use("/admin/analytics", adminAnalyticsRouter);
router.use("/admin/shipping", adminShippingRouter);

// Admin Pages APIs: Specific /home route BEFORE parameterized /:id route!
router.use("/admin/pages", adminPagesRouter);
router.use("/admin/pages", adminPageRouter);

router.use("/admin/blog", adminBlogRouter);
router.use("/admin/faqs", adminFaqRouter);
router.use("/admin/media", adminMediaRouter);
router.use("/admin/invoices", adminInvoiceRouter);
router.use("/admin/integrations", adminIntegrationRouter);

router.get(
  "/admin/dashboard",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const [
      totalProducts,
      activeProducts,
      books,
      otherProducts,
      categories,
      lowStock,
      activeCoupons,
      customers,
      digitalDownloads,
      orderStats,
      recentOrders,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { isActive: true } }),
      prisma.product.count({ where: { productType: "BOOK" } }),
      prisma.product.count({ where: { productType: "PHYSICAL" } }),
      prisma.category.count(),
      prisma.product.count({ where: { trackInventory: true, stockQuantity: { lte: 5 } } }),
      prisma.coupon.count({ where: { isActive: true } }),
      prisma.customer.count(),
      prisma.digitalDownload.count(),
      getOrderDashboardStats(),
      prisma.order.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          customerEmail: true,
          totalAmount: true,
          paymentStatus: true,
          paymentMethod: true,
          status: true,
          createdAt: true,
          shipment: { select: { carrier: true, trackingNumber: true, status: true } },
        },
      }),
    ]);

    ok(res, {
      totalProducts,
      activeProducts,
      books,
      otherProducts,
      categories,
      lowStockProducts: lowStock,
      activeCoupons,
      customers,
      digitalDownloads,
      recentOrders: recentOrders.map((o) => ({
        ...o,
        totalAmount: Number(o.totalAmount),
      })),
      ...orderStats,
    });
  })
);

export default router;
