import { Router } from "express";
import { requireAdmin } from "../../middleware/adminAuth.js";
import {
  handleListPublicBanners,
  handleListAdminBanners,
  handleCreateBanner,
  handleUpdateBanner,
  handleDeleteBanner,
} from "./banners.controller.js";

export const publicBannersRouter = Router();
publicBannersRouter.get("/", handleListPublicBanners);

export const adminBannersRouter = Router();
adminBannersRouter.get("/", requireAdmin, handleListAdminBanners);
adminBannersRouter.post("/", requireAdmin, handleCreateBanner);
adminBannersRouter.put("/:id", requireAdmin, handleUpdateBanner);
adminBannersRouter.delete("/:id", requireAdmin, handleDeleteBanner);

export default publicBannersRouter;
