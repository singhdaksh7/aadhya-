// Recommended upload sizes shown next to every admin image field, so editors upload
// correctly sized artwork. Matched against the field label (first match wins); a field
// can override with the `sizeHint` prop on ImagePickerInput.
const GUIDES = [
  [/favicon/i, "512 × 512 px (square PNG)"],
  [/signature/i, "400 × 150 px (PNG, transparent background)"],
  [/logo/i, "500 × 150 px (PNG with transparent background)"],
  [/\bog image/i, "1200 × 630 px"],
  [/cover|poster/i, "1080 × 1920 px (vertical 9:16)"],
  [/\bicon\b|badge|texture/i, "256 × 256 px (square PNG, transparent background)"],
  [/mobile/i, "1080 × 1350 px (portrait 4:5)"],
  [/desktop|banner|hero/i, "1920 × 700 px (wide)"],
  [/featured|header image/i, "1600 × 900 px (16:9)"],
  [/artwork/i, "800 × 800 px (PNG/WebP with transparency)"],
];

export const DEFAULT_IMAGE_SIZE = "1080 × 1080 px (square)";

export function recommendedImageSize(label = "") {
  for (const [re, size] of GUIDES) if (re.test(label)) return size;
  return DEFAULT_IMAGE_SIZE;
}
