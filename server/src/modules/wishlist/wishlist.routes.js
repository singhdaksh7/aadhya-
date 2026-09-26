import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok, created } from "../../utils/apiResponse.js";
import { requireCustomer } from "../../middleware/customerAuth.js";
import * as wishlistService from "./wishlist.service.js";

const wishlistRouter = Router();

wishlistRouter.get(
  "/",
  requireCustomer,
  asyncHandler(async (req, res) => {
    const items = await wishlistService.listCustomerWishlist(req.customer.id);
    ok(res, items);
  })
);

wishlistRouter.post(
  "/",
  requireCustomer,
  asyncHandler(async (req, res) => {
    const item = await wishlistService.addToWishlist(req.customer.id, req.body);
    ok(res, item, "Item added to wishlist.");
  })
);

wishlistRouter.delete(
  "/:id",
  requireCustomer,
  asyncHandler(async (req, res) => {
    const result = await wishlistService.removeFromWishlist(req.customer.id, req.params.id);
    ok(res, result, "Item removed from wishlist.");
  })
);

export default wishlistRouter;
