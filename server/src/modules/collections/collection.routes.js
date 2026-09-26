import { Router } from "express";
import { requireAdmin } from "../../middleware/adminAuth.js";
import * as controller from "./collection.controller.js";

export const publicCollectionRouter = Router();
publicCollectionRouter.get("/", controller.listPublicCollections);
publicCollectionRouter.get("/:slug", controller.getPublicCollectionBySlug);

export const adminCollectionRouter = Router();
adminCollectionRouter.use(requireAdmin);
adminCollectionRouter.get("/", controller.listAdminCollections);
adminCollectionRouter.get("/:id", controller.getAdminCollectionById);
adminCollectionRouter.post("/", controller.createCollection);
adminCollectionRouter.patch("/:id", controller.updateCollection);
adminCollectionRouter.put("/:id/products", controller.updateCollectionProducts);
adminCollectionRouter.delete("/:id", controller.deleteCollection);
