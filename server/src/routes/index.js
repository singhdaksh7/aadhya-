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

const router = Router();

router.get("/health", (req, res) => ok(res, { status: "ok" }));

// Public storefront APIs.
router.use("/products", publicProductRouter);
router.use("/categories", publicCategoryRouter);
router.use("/collections", publicCollectionRouter);
router.use("/coupons", publicCouponRouter);
router.use("/settings", publicSettingsRouter);
router.use("/newsletter", newsletterRouter);
router.use("/navigation", navigationRouter);
router.use("/pages", publicPagesRouter);
router.use("/banners", publicBannersRouter);
router.use("/promos", publicPromosRouter);

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
router.use("/account", profileRouter);
router.use("/account", accountRouter);
router.use("/cart", cartRouter);
router.use("/payments/razorpay", razorpayVerifyRouter);
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
router.use("/admin/pages", adminPagesRouter);
router.use("/admin/banners", adminBannersRouter);
router.use("/admin/promos", adminPromosRouter);

router.get(
  "/admin/dashboard",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const [totalProducts, activeProducts, books, otherProducts, categories, lowStock, activeCoupons, orderStats] =
      await Promise.all([
        prisma.product.count(),
        prisma.product.count({ where: { isActive: true } }),
        prisma.product.count({ where: { productType: "BOOK" } }),
        prisma.product.count({ where: { productType: "PHYSICAL" } }),
        prisma.category.count(),
        prisma.product.count({ where: { trackInventory: true, stockQuantity: { lte: 5 } } }),
        prisma.coupon.count({ where: { isActive: true } }),
        getOrderDashboardStats(),
      ]);

    ok(res, {
      totalProducts,
      activeProducts,
      books,
      otherProducts,
      categories,
      lowStockProducts: lowStock,
      activeCoupons,
      ...orderStats,
    });
  })
);

export default router;
