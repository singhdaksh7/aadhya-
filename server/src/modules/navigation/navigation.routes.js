import { Router } from "express";
import { requireAdmin } from "../../middleware/adminAuth.js";
import {
  handleGetPublicMenu,
  handleListAdminMenus,
  handleCreateMenu,
  handleUpdateMenu,
  handleAddMenuItem,
  handleUpdateMenuItem,
  handleDeleteMenuItem,
} from "./navigation.controller.js";

const router = Router();

// Public route
router.get("/:code", handleGetPublicMenu);

// Admin routes
router.get("/admin/menus", requireAdmin, handleListAdminMenus);
router.post("/admin/menus", requireAdmin, handleCreateMenu);
router.put("/admin/menus/:id", requireAdmin, handleUpdateMenu);
router.post("/admin/menus/:menuId/items", requireAdmin, handleAddMenuItem);
router.put("/admin/items/:itemId", requireAdmin, handleUpdateMenuItem);
router.delete("/admin/items/:itemId", requireAdmin, handleDeleteMenuItem);

export default router;

