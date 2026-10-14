import { z } from "zod";

// Decorative Edge Artwork: independent, admin-placed images (botanical motifs, line art, emblems...)
// stored as JSON inside the existing `decorations` site setting, so no database migration is needed.
// Artwork is purely decorative on the storefront (non-interactive); these bounds keep any saved
// configuration safe to render.

export const DECORATION_SCOPES = ["SITE", "HOME", "HOME_SECTION", "CATEGORIES", "CATEGORY", "PRODUCTS", "BOOKS", "BLOG", "PAGE"];
// Scopes that point at one specific thing and therefore need a target (category slug, CMS page slug, homepage section id).
export const SCOPES_WITH_TARGET = ["HOME_SECTION", "CATEGORY", "PAGE"];

const mediaUrl = z
  .string()
  .trim()
  .min(1, "Choose an image")
  .max(2048)
  .refine((value) => value.startsWith("/") || /^https?:\/\//i.test(value), "Image must be a relative or http(s) URL");
const num = (min, max) => z.number().finite().min(min).max(max);
const int = (min, max) => z.number().int().min(min).max(max);

export const decorationItemSchema = z
  .object({
    id: z.string().trim().min(1).max(64),
    enabled: z.boolean().default(true),
    name: z.string().trim().max(120).default(""),
    image: mediaUrl,
    alt: z.string().trim().max(240).default(""),
    scope: z.enum(DECORATION_SCOPES),
    targetId: z.string().trim().max(200).default(""),
    side: z.enum(["LEFT", "RIGHT", "BOTH"]).default("LEFT"),
    mirrorBoth: z.boolean().default(true), // with side BOTH, the right-hand copy is a mirror image of the left
    vertical: z.enum(["TOP", "CENTER", "BOTTOM"]).default("CENTER"),
    // Sizes in px. Tablet/mobile fall back to the desktop width scaled down when not set.
    width: int(20, 1200).default(260),
    maxWidth: int(0, 1600).default(0), // 0 = no cap
    widthTablet: int(0, 1200).default(0), // 0 = derive from desktop
    widthMobile: int(0, 800).default(0), // 0 = derive from desktop
    offsetX: int(-800, 800).default(0),
    offsetY: int(-1500, 1500).default(0),
    opacity: num(0.1, 1).default(1),
    rotation: int(-180, 180).default(0),
    flipH: z.boolean().default(false),
    flipV: z.boolean().default(false),
    layer: z.enum(["BEHIND", "MIDDLE", "ABOVE"]).default("MIDDLE"),
    positionMode: z.enum(["ABSOLUTE", "FIXED"]).default("ABSOLUTE"),
    // Non-destructive crop: the original media file is never changed.
    focalX: int(0, 100).default(50),
    focalY: int(0, 100).default(50),
    zoom: num(0.5, 3).default(1),
    frameAspect: num(0, 5).default(0), // width / height of the visible frame; 0 = the image's natural shape
    showDesktop: z.boolean().default(true),
    showTablet: z.boolean().default(true),
    showMobile: z.boolean().default(false), // conservative: large edge art is hidden on phones unless enabled
    sortOrder: int(0, 1000).default(0),
  })
  .refine((item) => !SCOPES_WITH_TARGET.includes(item.scope) || item.targetId !== "", {
    message: "This placement needs a target (category, page or homepage section)",
    path: ["targetId"],
  });

export const decorationsSchema = z
  .object({ items: z.array(decorationItemSchema).max(40) })
  .refine((value) => new Set(value.items.map((item) => item.id)).size === value.items.length, {
    message: "Decoration ids must be unique",
    path: ["items"],
  });

export const DEFAULT_DECORATIONS = { items: [] };
