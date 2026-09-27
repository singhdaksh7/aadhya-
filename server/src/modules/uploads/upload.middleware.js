import multer from "multer";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/ApiError.js";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

// Reject double-extension tricks ("file.pdf.exe", "cover.png.php") by
// requiring the filename to contain exactly one dot-segment matching an
// allowed extension, not just checking the last segment in isolation.
function hasDangerousDoubleExtension(originalname) {
  const segments = originalname.toLowerCase().split(".");
  if (segments.length <= 2) return false;
  // Any inner segment that looks like an executable/script extension is a red flag
  // regardless of what the final extension claims to be.
  const dangerous = new Set(["exe", "sh", "bat", "cmd", "php", "phtml", "js", "cgi", "msi", "com", "scr", "jar", "html", "htm", "svg"]);
  return segments.slice(1, -1).some((seg) => dangerous.has(seg));
}

function fileFilter(req, file, cb) {
  const ext = file.originalname.slice(file.originalname.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext) || hasDangerousDoubleExtension(file.originalname)) {
    return cb(ApiError.badRequest("Only JPEG, PNG, and WebP images are allowed"));
  }
  cb(null, true);
}

export const productImageMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.uploads.maxFileSizeMb * 1024 * 1024, files: 1 },
  fileFilter,
});

// Magic-byte ("file signature") checks — the client-supplied Content-Type
// and filename extension are both trivially spoofable, so before trusting a
// file we peek at its actual bytes. This is the real defense against
// "rename a script to .png" style tricks; the extension/MIME checks above
// are just a cheap first filter.
const IMAGE_SIGNATURES = [
  { mime: "image/jpeg", check: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", check: (b) => b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: "image/webp", check: (b) => b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP" },
];

function looksLikeAllowedImage(buffer) {
  return IMAGE_SIGNATURES.some(({ check }) => check(buffer));
}

function looksLikePdf(buffer) {
  return buffer.length >= 5 && buffer.toString("ascii", 0, 5) === "%PDF-";
}

function verifyImageContent(req, res, next) {
  if (!req.file) return next();
  if (!looksLikeAllowedImage(req.file.buffer)) {
    return next(ApiError.badRequest("File content does not match a JPEG, PNG, or WebP image"));
  }
  next();
}

export const productImageUpload = productImageMulter;
export { verifyImageContent };

const PDF_MAX_SIZE_MB = Number(process.env.BOOK_PDF_MAX_FILE_SIZE_MB || 50);

function pdfFileFilter(req, file, cb) {
  const ext = file.originalname.slice(file.originalname.lastIndexOf(".")).toLowerCase();
  if (file.mimetype !== "application/pdf" || ext !== ".pdf" || hasDangerousDoubleExtension(file.originalname)) {
    return cb(ApiError.badRequest("Only PDF files are allowed"));
  }
  cb(null, true);
}

export const bookPdfMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PDF_MAX_SIZE_MB * 1024 * 1024, files: 1 },
  fileFilter: pdfFileFilter,
});

function verifyPdfContent(req, res, next) {
  if (!req.file) return next();
  if (!looksLikePdf(req.file.buffer)) {
    return next(ApiError.badRequest("File content does not match a PDF document"));
  }
  next();
}

export const bookPdfUpload = bookPdfMulter;
export { verifyPdfContent };
