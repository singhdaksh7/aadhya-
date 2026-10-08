// Applies the sample storefront configuration through the Admin API:
//  - per-category filter groups for Books, Home Decor, Lighting and Home Textiles
//  - Demo reviews mode ON for the homepage Reviews section (only ever shown when there are no real
//    approved reviews)
// Safe to re-run. Turn demo reviews off again with DEMO_REVIEWS=off.
//
//   API_BASE=... ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/demo-content/configure-storefront.mjs
import { adminLogin, client, publicGet, API_BASE } from "./admin-client.mjs";

const g = (type, extra = {}) => ({ id: `${type.toLowerCase()}-${(extra.attributeKey || "x").toLowerCase()}`, type, enabled: true, showDesktop: true, showMobile: true, ...extra });
const PRESETS = {
  books: [g("CATEGORY", { label: "Theme", defaultOpen: true }), g("BOOK_AUTHOR", { label: "Author" }), g("BOOK_FORMAT", { label: "Format" }), g("BOOK_LANGUAGE", { label: "Language" }), g("PRICE"), g("AVAILABILITY")],
  "home-decor": [g("CATEGORY", { defaultOpen: true }), g("ATTRIBUTE", { attributeKey: "Material" }), g("ATTRIBUTE", { attributeKey: "Style" }), g("ATTRIBUTE", { attributeKey: "Color" }), g("PRICE"), g("AVAILABILITY")],
  lighting: [g("CATEGORY", { label: "Type", defaultOpen: true }), g("ATTRIBUTE", { attributeKey: "Material" }), g("ATTRIBUTE", { attributeKey: "Finish" }), g("PRICE"), g("AVAILABILITY")],
  "home-textiles": [g("CATEGORY", { defaultOpen: true }), g("ATTRIBUTE", { attributeKey: "Size" }), g("ATTRIBUTE", { attributeKey: "Material" }), g("ATTRIBUTE", { attributeKey: "Color" }), g("PRICE")],
};

async function main() {
  console.log(`Target API: ${API_BASE}`);
  const api = client(await adminLogin());
  const categories = (await publicGet("/categories"))?.data || [];
  const bySlug = new Map(categories.map((c) => [c.slug, c]));

  const settings = (await api.get("/admin/settings")).data;
  const existing = settings.catalogFilters?.categories || [];
  const configured = Object.entries(PRESETS).flatMap(([slug, groups]) => {
    const cat = bySlug.get(slug);
    if (!cat) { console.log(`skip filters (no category): ${slug}`); return []; }
    return [{ categoryId: cat.id, applyToSubcategories: true, groups: groups.map((grp, i) => ({ ...grp, order: i })) }];
  });
  const ids = new Set(configured.map((c) => c.categoryId));
  await api.put("/admin/settings", { catalogFilters: { categories: [...existing.filter((c) => !ids.has(c.categoryId)), ...configured] } });
  console.log(`filters configured for: ${Object.keys(PRESETS).filter((s) => bySlug.has(s)).join(", ")}`);

  const home = (await api.get("/admin/pages/home")).data;
  const section = (home.sections || []).find((s) => s.type === "TESTIMONIALS");
  if (!section) throw new Error("No Reviews (TESTIMONIALS) section on the homepage");
  const on = process.env.DEMO_REVIEWS !== "off";
  await api.put(`/admin/pages/sections/${section.id}`, { settings: { ...(section.settings || {}), demoMode: on } });
  console.log(`homepage demo reviews mode: ${on ? "ON" : "OFF"}`);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
