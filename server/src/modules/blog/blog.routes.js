import { Router } from "express";
import { requireAdmin } from "../../middleware/adminAuth.js";
import { verifyAccessToken } from "../../utils/tokens.js";
import { prisma } from "../../lib/prisma.js";
import {
  listPublicBlogPosts,
  getPublicBlogPost,
  listAdminBlogPosts,
  getAdminBlogPost,
  createAdminBlogPost,
  updateAdminBlogPost,
  deleteAdminBlogPost,
  publishAdminBlogPost
} from "./blog.controller.js";

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
    // Ignore invalid token on optional check
  }
  next();
}

export const publicBlogRouter = Router();
publicBlogRouter.get("/", listPublicBlogPosts);
publicBlogRouter.get("/:slug", optionalAdmin, getPublicBlogPost);

export const adminBlogRouter = Router();
adminBlogRouter.use(requireAdmin);
adminBlogRouter.get("/", listAdminBlogPosts);
adminBlogRouter.post("/", createAdminBlogPost);
adminBlogRouter.get("/:id", getAdminBlogPost);
adminBlogRouter.put("/:id", updateAdminBlogPost);
adminBlogRouter.patch("/:id", updateAdminBlogPost);
adminBlogRouter.delete("/:id", deleteAdminBlogPost);
adminBlogRouter.post("/:id/publish", publishAdminBlogPost);
