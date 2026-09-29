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

// SVG is intentionally NOT in this allow-list. SVG is an XML/script-capable
// format (<script>, event handler attributes, external references) and we
// do not have robust server-side SVG sanitization (e.g. a DOMPurify SVG
// profile) in place. Rather than accept SVG uploads with only superficial
// checks, uploads of image/svg+xml are rejected outright. Revisit only if
// proper sanitization is added.
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif"
]);

const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"
]);

// Reject double-extension tricks ("logo.png.exe") regardless of what the
// final extension claims to be.
const DANGEROUS_INNER_EXT = new Set(["exe", "sh", "bat", "cmd", "php", "phtml", "js", "cgi", "msi", "com", "scr", "jar", "html", "htm"]);
function hasDangerousDoubleExtension(originalname) {
  const segments = originalname.toLowerCase().split(".");
  if (segments.length <= 2) return false;
  return segments.slice(1, -1).some((seg) => DANGEROUS_INNER_EXT.has(seg));
}

function fileFilter(req, file, cb) {
  const ext = file.originalname.slice(file.originalname.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext) || hasDangerousDoubleExtension(file.originalname)) {
    return cb(ApiError.badRequest("Only JPEG, PNG, WebP, AVIF, and GIF images are allowed. SVG uploads are not supported."));
  }
  cb(null, true);
}

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter
});

// Magic-byte spot check for the raster formats — GIF is a legacy format
// without one reliable byte signature so it passes through unchanged to
// the (admin-only, requireAdmin) upload handler as before.
const SIGNATURES = [
  { mime: "image/jpeg", check: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", check: (b) => b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: "image/webp", check: (b) => b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP" },
];
function verifyMediaContent(req, res, next) {
  if (!req.file) return next();
  const applicable = SIGNATURES.filter((s) => s.mime === req.file.mimetype);
  if (applicable.length && !applicable.some((s) => s.check(req.file.buffer))) {
    return next(ApiError.badRequest("File content does not match its declared type"));
  }
  next();
}

export const adminMediaRouter = Router();
adminMediaRouter.use(requireAdmin);

adminMediaRouter.get("/", listAdminMedia);
adminMediaRouter.get("/:id", getAdminMedia);
adminMediaRouter.post("/upload", mediaUpload.single("file"), verifyMediaContent, uploadAdminMedia);
adminMediaRouter.put("/:id", updateAdminMediaMetadata);
adminMediaRouter.patch("/:id", updateAdminMediaMetadata);
adminMediaRouter.delete("/:id", deleteAdminMedia);
