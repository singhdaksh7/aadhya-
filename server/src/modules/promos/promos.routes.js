import { Router } from "express";
import { requireAdmin } from "../../middleware/adminAuth.js";
import {
  handleListPublicPromos,
  handleListAdminPromos,
  handleCreatePromo,
  handleUpdatePromo,
  handleDeletePromo,
} from "./promos.controller.js";

export const publicPromosRouter = Router();
publicPromosRouter.get("/", handleListPublicPromos);

export const adminPromosRouter = Router();
adminPromosRouter.get("/", requireAdmin, handleListAdminPromos);
adminPromosRouter.post("/", requireAdmin, handleCreatePromo);
adminPromosRouter.put("/:id", requireAdmin, handleUpdatePromo);
adminPromosRouter.delete("/:id", requireAdmin, handleDeletePromo);

export default publicPromosRouter;
