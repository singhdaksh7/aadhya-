import { Router } from "express";
import multer from "multer";
import { requireAdmin } from "../../middleware/adminAuth.js";
import { ApiError } from "../../utils/ApiError.js";
import {
  listAdminMedia,
  getAdminMedia,
  uploadAdminMedia,
  updateAdminMediaMetadata,
  deleteAdminMedia
} from "./media.controller.js";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/svg+xml"
]);

const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".svg"
]);

function fileFilter(req, file, cb) {
  const ext = file.originalname.slice(file.originalname.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
    return cb(ApiError.badRequest("Only JPEG, PNG, WebP, AVIF, GIF, and SVG images are allowed"));
  }
  cb(null, true);
}

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter
});

export const adminMediaRouter = Router();
adminMediaRouter.use(requireAdmin);

adminMediaRouter.get("/", listAdminMedia);
adminMediaRouter.get("/:id", getAdminMedia);
adminMediaRouter.post("/upload", mediaUpload.single("file"), uploadAdminMedia);
adminMediaRouter.put("/:id", updateAdminMediaMetadata);
adminMediaRouter.patch("/:id", updateAdminMediaMetadata);
adminMediaRouter.delete("/:id", deleteAdminMedia);
