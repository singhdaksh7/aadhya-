// Clearly-labelled DEMO / SAMPLE books for client demonstrations. Titles, authors and descriptions
// are original placeholders (no real book metadata). Authors carry the same "(Demo Sample)" suffix
// the existing demo books use, so they are never mistaken for real publications.

export const DEMO_PUBLISHER = "Aadya Sample Press";

// Subcategories of Books used by the "Browse by theme" chips and the Theme filter.
export const THEME_CATEGORIES = [
  { slug: "books-home-and-interiors", name: "Home & Interiors", sortOrder: 1 },
  { slug: "books-slow-living", name: "Slow Living", sortOrder: 2 },
  { slug: "books-coffee-table", name: "Coffee Table", sortOrder: 3 },
  { slug: "books-mindful-living", name: "Mindful Living", sortOrder: 4 },
  { slug: "books-design-inspiration", name: "Design Inspiration", sortOrder: 5 },
  { slug: "books-journals-and-guides", name: "Journaling & Guides", sortOrder: 6 },
];

const A = "Aadya Editorial Collective (Demo Sample)";
const M = "Meera Sample (Demo Sample)";
const R = "Rohan Placeholder (Demo Sample)";
const I = "Ila Example (Demo Sample)";

// palette: [background, accent, ink]
const P = { clay: ["#b8694a", "#f3e4d6", "#fff7ef"], sage: ["#7e8f7a", "#e8eee4", "#fbfdf9"], sand: ["#e8dccb", "#8a5a44", "#2b2723"], char: ["#2f2b27", "#d9a58a", "#faf6f0"], ivory: ["#f7f1e8", "#b8694a", "#2b2723"], dusk: ["#5d6b78", "#e5d8c8", "#ffffff"] };

export const DEMO_BOOKS = [
  { n: 1, title: "Quiet Spaces", subtitle: "Rooms that breathe", theme: "books-home-and-interiors", author: A, price: 899, pages: 192, binding: "Hardcover", flags: { isFeatured: true, isNewArrival: true }, palette: P.clay, blurb: "A demo title showcasing a calm, photograph-led guide to unhurried rooms, natural light and room-by-room restraint." },
  { n: 2, title: "The Warm Home", subtitle: "Texture, light and comfort", theme: "books-home-and-interiors", author: M, price: 749, pages: 168, binding: "Paperback", flags: { isNewArrival: true }, palette: P.sand, blurb: "A demo title about layering warmth at home through fabric, finish and everyday objects." },
  { n: 3, title: "Rooms with Soul", subtitle: "A design notebook", theme: "books-design-inspiration", author: R, price: 1099, pages: 224, binding: "Hardcover", flags: { isFeatured: true }, palette: P.char, blurb: "A demo title of room studies and styling ideas, written as a sample for the Aadya bookshelf." },
  { n: 4, title: "The Thoughtful Interior", subtitle: "Design with intention", theme: "books-design-inspiration", author: A, price: 949, pages: 208, binding: "Paperback", flags: { isBestSeller: true }, palette: P.ivory, blurb: "A demo title on choosing fewer, better things and arranging them with care." },
  { n: 5, title: "Notes on Slow Living", subtitle: "Small rituals, big calm", theme: "books-slow-living", author: M, price: 599, pages: 144, binding: "Paperback", flags: { isFeatured: true, isBestSeller: true }, palette: P.sage, blurb: "A demo title of short essays on pace, craft and the pleasure of doing things slowly." },
  { n: 6, title: "Everyday Styling", subtitle: "Simple arrangements that last", theme: "books-journals-and-guides", author: A, price: 449, pages: 112, binding: "Paperback", flags: { isNewArrival: true }, palette: P.dusk, blurb: "A demo styling guide: shelves, tables and corners, arranged in minutes." },
  { n: 7, title: "Objects & Rituals", subtitle: "The things we keep", theme: "books-coffee-table", author: I, price: 1399, pages: 256, binding: "Hardcover", flags: { isFeatured: true, isNewArrival: true }, palette: P.clay, blurb: "A demo coffee-table volume pairing handmade objects with the daily rituals around them." },
  { n: 8, title: "Living with Texture", subtitle: "Clay, linen, brass, wood", theme: "books-coffee-table", author: R, price: 1299, pages: 240, binding: "Hardcover", flags: {}, palette: P.sand, blurb: "A demo coffee-table title exploring natural materials through close-up studies." },
  { n: 9, title: "Light & Shadow at Home", subtitle: "A photographic study", theme: "books-coffee-table", author: A, price: 1499, pages: 264, binding: "Hardcover", flags: { isBestSeller: true }, palette: P.char, blurb: "A demo photographic study of how daylight moves through a quiet home." },
  { n: 10, title: "A Year of Mindful Mornings", subtitle: "Fifty-two small beginnings", theme: "books-mindful-living", author: M, price: 549, pages: 160, binding: "Paperback", flags: {}, palette: P.sage, blurb: "A demo weekly companion of gentle morning practices." },
  { n: 11, title: "The Quiet Practice", subtitle: "Attention, at home", theme: "books-mindful-living", author: I, price: 499, pages: 128, binding: "Paperback", flags: { isNewArrival: true }, palette: P.ivory, blurb: "A demo short guide to bringing steady attention into everyday spaces." },
  { n: 12, title: "The Home Journal", subtitle: "Plan, note, reflect", theme: "books-journals-and-guides", author: A, price: 399, pages: 120, binding: "Paperback", flags: { isBestSeller: true }, palette: P.dusk, blurb: "A demo guided journal for planning and reflecting on your home through the seasons." },
  { n: 13, title: "Seasonal Styling Notes", subtitle: "Four seasons, four edits", theme: "books-journals-and-guides", author: R, price: 479, pages: 136, binding: "Paperback", flags: {}, palette: P.clay, blurb: "A demo seasonal guide to refreshing a home with what you already own." },
].map((b) => ({
  ...b,
  slug: b.title.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  sku: `AADYA-DEMOBOOK-${String(b.n).padStart(3, "0")}`,
}));
