// Keep in sync with the server cap (IMAGE_MAX_MB in server/src/modules/uploads/upload.middleware.js).
export const MAX_IMAGE_MB = 2;

// Returns an error message when the file is too heavy for the storefront, otherwise null.
export function imageSizeError(file) {
  if (file && file.size > MAX_IMAGE_MB * 1024 * 1024) {
    return `This image is ${(file.size / 1048576).toFixed(1)} MB. Please upload an image under ${MAX_IMAGE_MB} MB (resize or export as JPG/WebP at about 1600 px wide) so the shop loads fast.`;
  }
  return null;
}
