import { Router } from "express";
import { requireAdmin } from "../../middleware/adminAuth.js";
import {
  handleGetPublicHomepage,
  handleGetAdminHomepage,
  handleCreateSection,
  handleUpdateSection,
  handleDeleteSection,
  handleDuplicateSection,
  handleReorderSections,
  handlePublishHomepage,
} from "./pages.controller.js";

export const publicPagesRouter = Router();
publicPagesRouter.get("/home", handleGetPublicHomepage);

export const adminPagesRouter = Router();
adminPagesRouter.get("/home", requireAdmin, handleGetAdminHomepage);
adminPagesRouter.post("/home/sections", requireAdmin, handleCreateSection);
adminPagesRouter.post("/:pageId/sections", requireAdmin, handleCreateSection);

adminPagesRouter.put("/sections/:sectionId", requireAdmin, handleUpdateSection);
adminPagesRouter.put("/home/sections/:sectionId", requireAdmin, handleUpdateSection);

adminPagesRouter.delete("/sections/:sectionId", requireAdmin, handleDeleteSection);
adminPagesRouter.delete("/home/sections/:sectionId", requireAdmin, handleDeleteSection);

adminPagesRouter.post("/sections/:sectionId/duplicate", requireAdmin, handleDuplicateSection);
adminPagesRouter.post("/home/sections/:sectionId/duplicate", requireAdmin, handleDuplicateSection);

adminPagesRouter.put("/sections/reorder", requireAdmin, handleReorderSections);
adminPagesRouter.put("/home/sections/reorder", requireAdmin, handleReorderSections);

adminPagesRouter.post("/publish", requireAdmin, handlePublishHomepage);
adminPagesRouter.post("/home/publish", requireAdmin, handlePublishHomepage);

export default publicPagesRouter;
