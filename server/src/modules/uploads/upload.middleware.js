import multer from "multer";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/ApiError.js";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function fileFilter(req, file, cb) {
  const ext = file.originalname.slice(file.originalname.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
    return cb(ApiError.badRequest("Only JPEG, PNG, and WebP images are allowed"));
  }
  cb(null, true);
}

export const productImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.uploads.maxFileSizeMb * 1024 * 1024, files: 1 },
  fileFilter,
});
