// Seeds the Admin-managed customer-facing content through the Admin API (no direct DB access):
//  - system pages: About, Shipping, Returns, Privacy, Terms (copy uses {{placeholders}} that are filled
//    from Store Settings at render time: shipping threshold, fee, dispatch/delivery, return window, ...)
//  - a small set of general store FAQs
//  - the Books mega menu secondary row, the `returns` policy settings and placeholder-based utility copy
// Safe to re-run: existing pages/FAQs are updated in place by slug/question, never duplicated.
//
//   API_BASE=... ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/demo-content/seed-policy-content.mjs
import { adminLogin, client, API_BASE } from "./admin-client.mjs";

const DRAFT_NOTE = "<p><em>Draft policy: this is general starter wording and should be reviewed and finalised for your business before launch.</em></p>";

const PAGES = [
  {
    slug: "about", name: "About Aadya", excerpt: "Considered objects for everyday living.",
    seoTitle: "About Aadya", seoDescription: "Aadya is a home and lifestyle store of handcrafted decor, textiles, lighting, fragrance and books.",
    content: [
      "<h2>Our approach</h2>",
      "<p>Aadya is a home and lifestyle store built around calm, considered objects: ceramics, linen and cotton textiles, woven pieces and warm lighting, alongside a small shelf of books on slow living and interiors.</p>",
      "<h2>What you'll find</h2>",
      "<ul><li>Home decor, textiles and lighting for living spaces</li><li>Table and dining pieces for slower meals</li><li>Candles, incense and diffusers</li><li>Books on slow living and interiors</li></ul>",
      "<h2>How we choose</h2>",
      "<p>We favour natural materials, honest finishes and pieces that are made to be lived with rather than only displayed.</p>",
      "<h2>Get in touch</h2>",
      "<p>Questions about an order or a piece? Visit our <a href=\"/contact\">contact page</a>.</p>",
    ].join(""),
  },
  {
    slug: "shipping", name: "Shipping & Delivery", excerpt: "How and when your order reaches you.",
    seoTitle: "Shipping & Delivery", seoDescription: "Dispatch times, delivery estimates, shipping charges and order tracking.",
    content: [
      "<h2>Dispatch and delivery</h2>",
      "<p>Orders are dispatched within {{dispatchEstimate}} and usually arrive within {{deliveryEstimate}}, depending on your location.</p>",
      "<h2>Shipping charges</h2>",
      "<p>Standard shipping is {{standardShippingAmount}}. Orders above {{freeShippingThreshold}} ship free.</p>",
      "<h2>Tracking your order</h2>",
      "<p>Follow your order on the <a href=\"/track-order\">Track Order</a> page using your order number and email address.</p>",
      "<h2>Cash on delivery</h2>",
      "<p>Cash on delivery is available on eligible orders; you will see it at checkout when it applies to your address.</p>",
      "<h2>Digital books</h2>",
      "<p>PDF editions are delivered as a download after purchase and are not shipped.</p>",
    ].join(""),
  },
  {
    slug: "returns", name: "Returns & Exchanges", excerpt: "Our return window and how to start a return.",
    seoTitle: "Returns & Exchanges", seoDescription: "Return window, eligibility and how to request a return.",
    content: [
      "<h2>Return window</h2>",
      "<p>You can request a return within {{returnWindowDays}} days of delivery.</p>",
      "<h2>How to request a return</h2>",
      "<p>Sign in to your account, open the order and choose the return option. You can follow the status of your request from the same page.</p>",
      "<h2>Eligibility</h2>",
      "<p>Items should be unused and in their original condition. Digital books (PDF) cannot be returned. Many pieces are handmade, so small natural variations in colour and texture are expected and are not a defect.</p>",
      "<h2>Damaged or defective items</h2>",
      "<p>If an item arrives damaged, contact us through the <a href=\"/contact\">contact page</a> with your order number and photos so we can help.</p>",
      "<h2>Refunds</h2>",
      "<p>Once a return is approved, the refund status is shown on your return request.</p>",
    ].join(""),
  },
  {
    slug: "privacy", name: "Privacy Policy", excerpt: "How we handle your information.",
    seoTitle: "Privacy Policy", seoDescription: "What information we collect, how it is used and how to contact us.",
    content: [
      DRAFT_NOTE,
      "<h2>Information we collect</h2>",
      "<p>We collect the details you give us to run your account and fulfil orders: name, email address, phone number and delivery and billing addresses.</p>",
      "<h2>Orders and payments</h2>",
      "<p>Order details are stored so we can process, ship and support your purchase. Online payments are handled by our payment provider; we do not store full card details.</p>",
      "<h2>Cookies and analytics</h2>",
      "<p>We use cookies and basic analytics to keep your cart and sign-in working and to understand how the store is used.</p>",
      "<h2>Service providers</h2>",
      "<p>We share information only with the providers needed to take payment, deliver your order and send order emails.</p>",
      "<h2>Contact</h2>",
      "<p>For privacy questions, visit our <a href=\"/contact\">contact page</a>.</p>",
    ].join(""),
  },
  {
    slug: "terms", name: "Terms of Service", excerpt: "The terms that apply when you use our store.",
    seoTitle: "Terms of Service", seoDescription: "The terms that apply to browsing and buying from this store.",
    content: [
      DRAFT_NOTE,
      "<h2>Using the store</h2>",
      "<p>By browsing or placing an order you agree to these terms. Please do not use the store unlawfully or in a way that could harm it or other customers.</p>",
      "<h2>Orders and pricing</h2>",
      "<p>Prices are shown in rupees. We may cancel an order if a product is unavailable or a price was listed in error, and will refund any payment taken.</p>",
      "<h2>Shipping and returns</h2>",
      "<p>Delivery and returns are described on our <a href=\"/shipping\">Shipping</a> and <a href=\"/returns\">Returns</a> pages.</p>",
      "<h2>Content</h2>",
      "<p>Text, images and design on this store belong to the store or its licensors and may not be reused without permission.</p>",
      "<h2>Contact</h2>",
      "<p>Questions about these terms? Visit our <a href=\"/contact\">contact page</a>.</p>",
    ].join(""),
  },
];

const FAQS = [
  ["Shipping", "shipping", "How long does shipping take?", "<p>Orders are dispatched within {{dispatchEstimate}} and usually arrive within {{deliveryEstimate}}, depending on your location.</p>"],
  ["Shipping", "shipping", "When is shipping free?", "<p>Standard shipping is {{standardShippingAmount}}. Orders above {{freeShippingThreshold}} ship free.</p>"],
  ["Returns", "returns", "Can I return an item?", "<p>Yes. You can request a return within {{returnWindowDays}} days of delivery. Items should be unused and in their original condition. See our <a href=\"/returns\">Returns page</a> for details.</p>"],
  ["Orders", "orders", "How can I track my order?", "<p>Use the <a href=\"/track-order\">Track Order</a> page with your order number and email address, or open the order from your account.</p>"],
  ["Orders", "orders", "What payment methods are available?", "<p>You can pay online at checkout, or choose cash on delivery where it is available for your address.</p>"],
  ["Support", "support", "How do I contact support?", "<p>Visit our <a href=\"/contact\">contact page</a> and we will get back to you.</p>"],
];

const BOOKS_ROW = {
  enabled: true,
  items: [
    { id: "row-new", label: "New Releases", destinationType: "CUSTOM_URL", destination: "/shop/books#new-releases", enabled: true, showDesktop: true, showMobile: true },
    { id: "row-editors", label: "Editor’s Picks", destinationType: "CUSTOM_URL", destination: "/shop/books#editors-picks", enabled: true, showDesktop: true, showMobile: true },
    { id: "row-slow", label: "Slow Living", destinationType: "CATEGORY", categorySlug: "books-slow-living", enabled: true, showDesktop: true, showMobile: true },
    { id: "row-journals", label: "Journals & Guides", destinationType: "CATEGORY", categorySlug: "books-journals-and-guides", enabled: true, showDesktop: true, showMobile: true },
  ].map((item, i) => ({ ...item, sortOrder: i + 1 })),
};

// List endpoints return either { data: [...] }, { data: { items } } or { items } depending on the module.
const asList = (body) => (Array.isArray(body?.data) ? body.data : body?.data?.items ?? body?.items ?? []);

async function main() {
  console.log(`Target API: ${API_BASE}`);
  const api = client(await adminLogin());

  // Pages: upsert by slug, published.
  const list = asList(await api.get("/admin/pages?limit=100"));
  let aboutImage = null;
  try {
    aboutImage = asList(await api.get("/admin/media?search=aadya-14-&limit=5"))[0]?.url || null;
  } catch { /* optional hero image */ }
  for (const p of PAGES) {
    const body = { name: p.name, slug: p.slug, pageType: "STANDARD", status: "PUBLISHED", content: p.content, excerpt: p.excerpt, seoTitle: p.seoTitle, seoDescription: p.seoDescription, ...(p.slug === "about" && aboutImage ? { featuredImage: aboutImage } : {}) };
    const existing = list.find((x) => x.slug === p.slug);
    if (existing) { await api.put(`/admin/pages/${existing.id}`, body); console.log(`page updated: ${p.slug}`); }
    else { await api.post("/admin/pages", body); console.log(`page created: ${p.slug}`); }
  }

  // FAQs: categories + items, matched by name/question.
  const catList = asList(await api.get("/admin/faqs/categories"));
  const byName = new Map(catList.map((c) => [c.name, c]));
  let order = 0;
  for (const [name, slug] of [...new Set(FAQS.map((f) => `${f[0]}|${f[1]}`))].map((s) => s.split("|"))) {
    if (!byName.has(name)) byName.set(name, (await api.post("/admin/faqs/categories", { name, slug, sortOrder: order, isActive: true })).data);
    order += 1;
  }
  const itemList = asList(await api.get("/admin/faqs/items"));
  for (const [i, [catName, , question, answer]] of FAQS.entries()) {
    const body = { categoryId: byName.get(catName).id, question, answer, sortOrder: i, isActive: true };
    const existing = itemList.find((x) => x.question === question);
    if (existing) await api.put(`/admin/faqs/items/${existing.id}`, body); else await api.post("/admin/faqs/items", body);
  }
  console.log(`faqs ensured: ${FAQS.length}`);

  // Settings: Books secondary row, return policy, placeholder-based utility/ticker copy.
  const s = (await api.get("/admin/settings")).data;
  const header = JSON.parse(JSON.stringify(s.header || {}));
  const items2 = header.primaryNav?.items || [];
  const books = items2.find((i) => i.categorySlug === "books" || i.destinationType === "BOOKS");
  if (books) books.secondaryRow = BOOKS_ROW; else console.log("skip secondary row: no Books nav item");
  const bar = header.utilityBar || {};
  bar.items = (bar.items || []).map((i) => (/free ship/i.test(i.label || "") ? { ...i, label: "Free shipping on orders {freeShippingThreshold}+" } : /return/i.test(i.label || "") ? { ...i, label: "Easy {returnWindowDays}-day returns" } : i));
  header.utilityBar = bar;
  if (header.promoTicker) header.promoTicker.fallbackMessage = "Free delivery on orders above {freeShippingThreshold}";
  await api.put("/admin/settings", {
    header,
    returns: { ...(s.returns || {}), enabled: s.returns?.enabled !== false, windowDays: s.returns?.windowDays ?? 7 },
    checkout: { ...(s.checkout || {}), pricesIncludeTax: s.checkout?.pricesIncludeTax !== false },
  });
  console.log("settings updated: books secondary row, returns, utility copy");

  // Promo ticker messages: placeholder-based so they follow the shipping setting.
  const promos = asList(await api.get("/admin/promos"));
  for (const p of promos) {
    if (/free (standard )?delivery/i.test(p.message || "")) await api.put(`/admin/promos/${p.id}`, { title: p.title, message: "Free standard delivery on orders above {freeShippingThreshold}", isActive: p.isActive });
    if (/returns/i.test(p.message || "")) await api.put(`/admin/promos/${p.id}`, { title: p.title, message: "Easy {returnWindowDays}-day returns on eligible orders", isActive: p.isActive });
  }
  console.log("promo messages updated");
}

main().catch((err) => { console.error(err.message); process.exit(1); });
