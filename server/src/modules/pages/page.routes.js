import { Router } from "express";
import { requireAdmin } from "../../middleware/adminAuth.js";
import { verifyAccessToken } from "../../utils/tokens.js";
import { prisma } from "../../lib/prisma.js";
import {
  getPublicPage,
  listAdminPages,
  getAdminPage,
  createAdminPage,
  updateAdminPage,
  deleteAdminPage,
  publishAdminPage
} from "./page.controller.js";

async function optionalAdmin(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (token) {
      const payload = verifyAccessToken(token);
      if (payload.type === "access" && payload.audience === "admin") {
        const admin = await prisma.adminUser.findUnique({ where: { id: payload.sub } });
        if (admin && admin.isActive) {
          req.adminUser = admin;
        }
      }
    }
  } catch {
    // Ignore invalid token on optional admin check
  }
  next();
}

export const publicPageRouter = Router();
publicPageRouter.get("/:slug", optionalAdmin, getPublicPage);

export const adminPageRouter = Router();
adminPageRouter.use(requireAdmin);
adminPageRouter.get("/", listAdminPages);
adminPageRouter.post("/", createAdminPage);
adminPageRouter.get("/:id", getAdminPage);
adminPageRouter.put("/:id", updateAdminPage);
adminPageRouter.patch("/:id", updateAdminPage);
adminPageRouter.delete("/:id", deleteAdminPage);
adminPageRouter.post("/:id/publish", publishAdminPage);
