import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/utils/password.js";
import { saveBuffer } from "../src/modules/uploads/storage.js";
import { savePdfBuffer } from "../src/modules/uploads/storage.js";

const prisma = new PrismaClient();

function slugify(input) {
  return input
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Mirrors src/data/books.js at the time this backend was introduced.
// Kept inline (rather than importing the frontend file) so the backend
// has no build-time dependency on client source.
const legacyBooks = [
  {
    id: "b1",
    title: "Everyday Resilience (Demo Title)",
    author: "Dr. Aqsa — Author Placeholder",
    description:
      "A demo book placeholder exploring practical, everyday approaches to emotional resilience.",
  },
  {
    id: "b2",
    title: "Notes on Nurture (Demo Title)",
    author: "Author Placeholder",
    description: "A demo book placeholder reflecting on nurture, care and everyday wellbeing practices.",
  },
  {
    id: "b3",
    title: "The Reflective Practitioner's Journal (Demo Title)",
    author: "Author Placeholder",
    description: "A demo book placeholder designed as a guided journal for reflective practice.",
  },
];

// Mirrors src/data/products.js.
const legacyProducts = [
  {
    id: "p1",
    name: "Handwoven Wall Hanging",
    category: "Handcrafted Accessories",
    price: 2250,
    description:
      "A textured macrame wall hanging in earthy tones, handwoven to bring natural warmth to any room.",
    image: "https://images.unsplash.com/photo-1776721977064-d4e5389db6b9?auto=format&fit=crop&w=1200&q=75",
  },
  {
    id: "p2",
    name: "Neutral Ceramic Vase",
    category: "Home Decor",
    price: 1890,
    description: "A hand-finished ceramic vase in a soft neutral tone, ideal for dried florals.",
    image: "https://images.unsplash.com/photo-1643569556871-91ec60671ed7?auto=format&fit=crop&w=1200&q=75",
  },
  {
    id: "p3",
    name: "Ceramic Serving Tray Set",
    category: "Home Decor",
    price: 1650,
    description: "A trio of ribbed ceramic bowls on a natural wooden tray, for everyday serving with quiet elegance.",
    image: "https://images.unsplash.com/photo-1784901391108-d9a0f3911bea?auto=format&fit=crop&w=1200&q=75",
  },
  {
    id: "p4",
    name: "Ceramic Decor Vase Collection",
    category: "Home Decor",
    price: 2100,
    description: "A curated set of hand-finished ceramic vases in warm, neutral tones.",
    image: "https://images.unsplash.com/photo-1597696929736-6d13bed8e6a8?auto=format&fit=crop&w=1200&q=75",
  },
  {
    id: "p5",
    name: "Hand-Poured Beeswax Candle",
    category: "Wellness Decor",
    price: 1150,
    description: "A hand-poured beeswax candle with a gentle, calming scent, glowing warmly at dusk.",
    image: "https://images.unsplash.com/photo-1783005876092-7025151b853f?auto=format&fit=crop&w=1200&q=75",
  },
  {
    id: "p6",
    name: "Handwoven Storage Basket",
    category: "Handcrafted Accessories",
    price: 990,
    description: "A natural wicker basket, handwoven for everyday storage with quiet, organic texture.",
    image: "https://images.unsplash.com/photo-1562835154-7ac43f0fec10?auto=format&fit=crop&w=1200&q=75",
  },
];

async function seedAdmin() {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error(
      "ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD must be set (see server/.env.example) before seeding."
    );
  }

  const existing = await prisma.adminUser.findUnique({ where: { email: ADMIN_EMAIL.toLowerCase() } });
  if (existing) {
    console.log(`Admin user already exists for ${ADMIN_EMAIL}, skipping.`);
    return;
  }

  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  await prisma.adminUser.create({
    data: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL.toLowerCase(),
      passwordHash,
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });
  console.log(`Seeded admin user: ${ADMIN_EMAIL}`);
}

async function upsertCategory({ name, sortOrder }) {
  const slug = slugify(name);
  return prisma.category.upsert({
    where: { slug },
    update: {},
    create: { name, slug, isActive: true, sortOrder },
  });
}

async function seedBooksCategoryAndProducts() {
  const booksCategory = await upsertCategory({ name: "Books", sortOrder: 0 });

  for (const book of legacyBooks) {
    const slug = slugify(book.title.replace(/\(demo title\)/i, "").trim());
    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) continue;

    await prisma.product.create({
      data: {
        name: book.title,
        slug,
        shortDescription: book.description.slice(0, 140),
        description: book.description,
        productType: "BOOK",
        categoryId: booksCategory.id,
        sku: `BOOK-${book.id.toUpperCase()}`,
        price: 399,
        stockQuantity: 25,
        trackInventory: true,
        isFeatured: false,
        isActive: true,
        bookDetail: { create: { author: book.author, language: "English" } },
      },
    });
  }
  console.log(`Seeded ${legacyBooks.length} books under category "Books".`);
}

async function seedShopCategoriesAndProducts() {
  const categoryNames = [...new Set(legacyProducts.map((p) => p.category))];
  const categoryMap = new Map();
  let sortOrder = 1;
  for (const name of categoryNames) {
    categoryMap.set(name, await upsertCategory({ name, sortOrder: sortOrder++ }));
  }

  for (const product of legacyProducts) {
    const slug = slugify(product.name);
    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) continue;

    const category = categoryMap.get(product.category);
    const created = await prisma.product.create({
      data: {
        name: product.name,
        slug,
        shortDescription: product.description.slice(0, 140),
        description: product.description,
        productType: "PHYSICAL",
        categoryId: category.id,
        sku: `TUSHAQSA-${product.id.toUpperCase()}`,
        price: product.price,
        stockQuantity: 15,
        trackInventory: true,
        isFeatured: product.id === "p1" || product.id === "p5",
        isActive: true,
      },
    });

    await prisma.productImage.create({
      data: {
        productId: created.id,
        url: product.image,
        altText: product.name,
        isPrimary: true,
        sortOrder: 0,
      },
    });
  }
  console.log(`Seeded ${legacyProducts.length} Tushaqsa Handcrafted products.`);
}

// Clearly labelled demo merchandising data. Image paths intentionally use a
// non-copyrighted placeholder service and must be replaced before launch.
const extraPhysical = [
  "Decor Cushion|Textiles", "Linen Table Runner|Textiles", "Woven Throw|Textiles", "Floor Cushion|Textiles",
  "Ceramic Vase|Home Decor", "Terracotta Lamp|Lighting", "Reading Lamp|Lighting", "Brass Incense Holder|Wellness Decor",
  "Cedar Candle|Wellness Decor", "Cotton Journal Pouch|Handcrafted Accessories", "Rattan Planter|Home Decor", "Clay Mug Set|Home Decor",
  "Wooden Book Stand|Handcrafted Accessories", "Sage Tea Tray|Home Decor", "Natural Storage Bin|Handcrafted Accessories",
];
const extraBooks = ["The Quiet Room", "Small Rituals", "Notes for Care", "The Listening Practice", "A Gentle Atlas", "Rooms for Reflection", "The Everyday Notebook"];
async function seedDevCoupons() {
  const coupons = [
    {
      code: "PHASED10",
      name: "Phase D 10% Off",
      description: "10% off on all items above ₹1,000 (Demo Coupon)",
      discountType: "PERCENTAGE",
      value: 10,
      minimumOrderAmount: 1000,
      maximumDiscountAmount: 1000,
      targetType: "ALL",
      isActive: true,
    },
    {
      code: "OFFER500",
      name: "Flat ₹500 Off",
      description: "Flat ₹500 off on orders above ₹2,000 (Demo Coupon)",
      discountType: "FIXED",
      value: 500,
      minimumOrderAmount: 2000,
      targetType: "ALL",
      isActive: true,
    },
  ];

  for (const couponData of coupons) {
    const existing = await prisma.coupon.findUnique({ where: { code: couponData.code } });
    if (!existing) {
      await prisma.coupon.create({ data: couponData });
    }
  }
  console.log("Seeded Phase D development coupons (PHASED10, OFFER500).");
}

async function seedExpandedDemo() {
  const categories = new Map();
  for (const [name, sortOrder] of [["Textiles", 4], ["Lighting", 5], ["Books", 0], ["Home Decor", 1], ["Wellness Decor", 2], ["Handcrafted Accessories", 3]]) {
    categories.set(name, await upsertCategory({ name, sortOrder }));
  }

  const physical = [...legacyProducts.map((p) => `${p.name}|${p.category}`), ...extraPhysical];
  const variants = {
    "Decor Cushion": [["Small", "CUSHION-S", 12, 899], ["Large", "CUSHION-L", 8, 1299]],
    "Ceramic Vase": [["Ivory", "VASE-IVORY", 10, 1890], ["Sage", "VASE-SAGE", 7, 1950]],
    "Woven Throw": [["Natural", "THROW-NAT", 9, 1490], ["Terracotta", "THROW-TERR", 6, 1590]],
    "Terracotta Lamp": [["Short", "LAMP-SHORT", 5, 2100], ["Tall", "LAMP-TALL", 4, 2700]],
  };

  for (let i = 0; i < physical.length; i++) {
    const [name, categoryName] = physical[i].split("|");
    const slug = slugify(name);
    let product = await prisma.product.findUnique({ where: { slug } });
    if (!product) {
      product = await prisma.product.create({
        data: {
          name,
          slug,
          brand: "Aadya Craft",
          shortDescription: `Demo ${name} for Aadya merchandising.`,
          description: `Demo-only ${name}; safe placeholder catalog content.`,
          productType: "PHYSICAL",
          categoryId: categories.get(categoryName).id,
          sku: `DEMO-P-${String(i + 1).padStart(2, "0")}`,
          price: 900 + i * 75,
          mrp: 1200 + i * 75,
          costPrice: 450 + i * 35,
          stockQuantity: 20,
          lowStockThreshold: 5,
          isFeatured: i < 4,
          isBestSeller: i % 5 === 0,
          isNewArrival: i % 4 === 0,
          isTrending: i % 3 === 0,
          tags: ["handcrafted", "decor", categoryName.toLowerCase()],
          materials: "Solid Brass & Terracotta",
          dimensions: "10 x 6 x 4 inches",
          careInstructions: "Wipe with damp cloth",
          whatsIncluded: "1x Decor Piece",
          shippingInformation: "Dispatched in 24 hours",
          attributes: { material: "Demo material", collection: "Aadya demo" },
        },
      });
    }

    if (variants[name]) {
      for (const [variantName, sku, stockQuantity, priceOverride] of variants[name]) {
        await prisma.productVariant.upsert({
          where: { sku },
          update: {},
          create: { productId: product.id, name: variantName, sku, stockQuantity, priceOverride, attributes: { option: variantName } },
        });
      }
    }
  }

  for (let i = 0; i < extraBooks.length; i++) {
    const name = `${extraBooks[i]} (Demo Title)`;
    const slug = slugify(name.replace("(Demo Title)", ""));
    if (!(await prisma.product.findUnique({ where: { slug } }))) {
      await prisma.product.create({
        data: {
          name,
          slug,
          shortDescription: "Demo book catalogue entry.",
          description: "Demo-only original placeholder book data without cover artwork.",
          productType: "BOOK",
          categoryId: categories.get("Books").id,
          sku: `DEMO-B-${i + 4}`,
          price: 399 + i * 20,
          mrp: 499 + i * 20,
          costPrice: 180 + i * 10,
          stockQuantity: 25,
          isFeatured: i < 2,
          isBestSeller: i % 3 === 0,
          isNewArrival: i % 2 === 0,
          isTrending: i % 2 === 1,
          bookDetail: { create: { author: "Aadya Demo Author", language: "English", pageCount: 160 + i * 8 } },
        },
      });
    }
  }

  const collectionsToSeed = [
    { name: "New Arrivals", type: "NEW_ARRIVAL", sortOrder: 0 },
    { name: "Best Sellers", type: "BEST_SELLER", sortOrder: 1 },
    { name: "Trending Objects", type: "TRENDING", sortOrder: 2 },
    { name: "Under ₹1500", type: "PRICE_RANGE", ruleConfig: { maxPrice: 1500 }, sortOrder: 3 },
    { name: "Textile Gallery", type: "CATEGORY", ruleConfig: { categoryId: categories.get("Textiles").id }, sortOrder: 4 },
  ];

  for (const colData of collectionsToSeed) {
    const slug = slugify(colData.name);
    const existingCol = await prisma.collection.findUnique({ where: { slug } });
    if (!existingCol) {
      await prisma.collection.create({
        data: {
          title: colData.name,
          slug,
          description: `Curated ${colData.name} series`,
          type: colData.type,
          ruleConfig: colData.ruleConfig ?? undefined,
          isActive: true,
          sortOrder: colData.sortOrder,
        },
      });
    }
  }

  await seedDevCoupons();
}

// ---------------------------------------------------------------------------
// Phase-seed demo catalog: 3 physical Aadya-style home-goods products and
// 3 book products (physical-only / PDF-only / both), with generated
// placeholder SVG cover/product images and 2 generated placeholder PDF
// files for the digital-capable books. Everything below is idempotent —
// every write is an upsert keyed on a stable identifier (product slug,
// category slug, or the productId_format unique constraint on
// BookFormatOption) so running the seed twice never creates duplicates.
// ---------------------------------------------------------------------------

// Simple, original, non-copyrighted placeholder artwork: a solid-color SVG
// rectangle with a centered text label naming the product. Saved through
// the same storage.save() path used by real admin-uploaded product images.
function placeholderSvg(label, color) {
  const safeLabel = String(label).replace(/[<&>]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">` +
      `<rect width="800" height="600" fill="${color}"/>` +
      `<text x="400" y="300" font-family="sans-serif" font-size="36" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${safeLabel}</text>` +
      `<text x="400" y="350" font-family="sans-serif" font-size="18" fill="#ffffffcc" text-anchor="middle">Aadya demo placeholder image</text>` +
      `</svg>`,
    "utf-8"
  );
}

async function uploadPlaceholderImage(label, color) {
  const svg = placeholderSvg(label, color);
  return saveBuffer(svg, "image/svg+xml");
}

// Minimal hand-written, valid single-page PDF (no external dependency —
// pdfkit is not installed in this project). Content is clearly marked as
// placeholder demo text, never real book content.
function buildPlaceholderPdf(title) {
  const text = `Aadya Demo Digital Book - ${title} - This is placeholder content for demonstration and testing purposes only.`;
  const escaped = text.replace(/([()\\])/g, "\\$1");
  const contentStream = `BT /F1 16 Tf 50 700 Td (${escaped}) Tj ET`;

  const objects = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objects.push(
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>"
  );
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push(`<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "utf-8");
}

async function upsertProductImage(productId, url, altText) {
  const existing = await prisma.productImage.findFirst({ where: { productId, url } });
  if (existing) return existing;
  return prisma.productImage.create({
    data: { productId, url, altText, isPrimary: true, sortOrder: 0 },
  });
}

async function upsertBookFormatOption(productId, format, data) {
  return prisma.bookFormatOption.upsert({
    where: { productId_format: { productId, format } },
    update: data,
    create: { productId, format, ...data },
  });
}

async function seedPhaseSeedDemoCatalog() {
  const homeGoodsCategory = await upsertCategory({ name: "Home Goods", sortOrder: 10 });
  const booksCategory = await upsertCategory({ name: "Books", sortOrder: 0 });

  // --- 3 normal (physical) products -----------------------------------
  const physicalProducts = [
    {
      slug: "handcrafted-terracotta-diya-set",
      name: "Handcrafted Terracotta Diya Set",
      sku: "SEED-DIYA-001",
      price: 799,
      salePrice: 649,
      description:
        "A set of six hand-shaped terracotta diyas, fired and finished in earthy tones — a warm, grounded addition to any festive tablescape.",
      shortDescription: "Set of 6 hand-shaped terracotta diyas.",
      stockQuantity: 40,
      tags: ["terracotta", "diya", "handcrafted", "festive"],
      isFeatured: true,
      isNewArrival: true,
      color: "#b5562d",
    },
    {
      slug: "linen-cushion-cover",
      name: "Linen Cushion Cover",
      sku: "SEED-LINEN-002",
      price: 999,
      salePrice: null,
      description:
        "A breathable, stonewashed linen cushion cover in a soft neutral tone, finished with a concealed zip for an unobtrusive everyday look.",
      shortDescription: "Stonewashed linen cushion cover, neutral tone.",
      stockQuantity: 60,
      tags: ["linen", "cushion", "home-textiles"],
      isFeatured: false,
      isBestSeller: true,
      color: "#8a7f6b",
    },
    {
      slug: "artisan-ceramic-vase",
      name: "Artisan Ceramic Vase",
      sku: "SEED-VASE-003",
      price: 1450,
      salePrice: 1290,
      description:
        "A hand-thrown ceramic vase with a matte glaze, subtly irregular in shape — each piece unique, ideal for dried or fresh stems alike.",
      shortDescription: "Hand-thrown matte ceramic vase.",
      stockQuantity: 25,
      tags: ["ceramic", "vase", "home-decor"],
      isFeatured: true,
      isTrending: true,
      color: "#4f6d5b",
    },
  ];

  for (const p of physicalProducts) {
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        sku: p.sku,
        price: p.price,
        salePrice: p.salePrice,
        description: p.description,
        shortDescription: p.shortDescription,
        stockQuantity: p.stockQuantity,
        tags: p.tags,
        isFeatured: Boolean(p.isFeatured),
        isBestSeller: Boolean(p.isBestSeller),
        isNewArrival: Boolean(p.isNewArrival),
        isTrending: Boolean(p.isTrending),
      },
      create: {
        name: p.name,
        slug: p.slug,
        sku: p.sku,
        productType: "PHYSICAL",
        categoryId: homeGoodsCategory.id,
        price: p.price,
        salePrice: p.salePrice,
        description: p.description,
        shortDescription: p.shortDescription,
        stockQuantity: p.stockQuantity,
        trackInventory: true,
        tags: p.tags,
        isActive: true,
        isFeatured: Boolean(p.isFeatured),
        isBestSeller: Boolean(p.isBestSeller),
        isNewArrival: Boolean(p.isNewArrival),
        isTrending: Boolean(p.isTrending),
      },
    });

    const existingImage = await prisma.productImage.findFirst({ where: { productId: product.id } });
    if (!existingImage) {
      const url = await uploadPlaceholderImage(p.name, p.color);
      await upsertProductImage(product.id, url, p.name);
    }
  }
  console.log(`Seeded ${physicalProducts.length} phase-seed physical products under "Home Goods".`);

  // --- 3 book products ---------------------------------------------------
  const books = [
    {
      slug: "the-art-of-slow-living",
      name: "The Art of Slow Living",
      sku: "SEED-BOOK-PHYS-001",
      mode: "PHYSICAL_ONLY",
      price: 599,
      description:
        "A gentle, demo-only guide to unhurried daily rituals — placeholder book content for catalogue and checkout testing.",
      author: "Aadya Editorial Collective (Demo Author)",
      isbn: "DEMO-ISBN-0000000001",
      publisher: "Aadya Press (Demo Publisher)",
      language: "English",
      pages: 184,
      color: "#3d4a63",
    },
    {
      slug: "aadya-home-styling-guide",
      name: "Aadya Home Styling Guide",
      sku: "SEED-BOOK-PDF-002",
      mode: "PDF_ONLY",
      price: 349,
      description:
        "A demo-only digital styling guide covering seasonal home-decor arrangements — placeholder content for PDF fulfilment testing.",
      author: "Aadya Editorial Collective (Demo Author)",
      isbn: "DEMO-ISBN-0000000002",
      publisher: "Aadya Press (Demo Publisher)",
      language: "English",
      pages: 96,
      color: "#6b4f80",
    },
    {
      slug: "spaces-of-stillness",
      name: "Spaces of Stillness",
      sku: "SEED-BOOK-BOTH-003",
      mode: "BOTH",
      price: 699,
      description:
        "A demo-only photo-essay style volume on calm interiors, available in physical and PDF formats — placeholder content for fulfilment testing.",
      author: "Aadya Editorial Collective (Demo Author)",
      isbn: "DEMO-ISBN-0000000003",
      publisher: "Aadya Press (Demo Publisher)",
      language: "English",
      pages: 220,
      color: "#8a5a44",
    },
  ];

  for (const b of books) {
    const product = await prisma.product.upsert({
      where: { slug: b.slug },
      update: {
        name: b.name,
        sku: b.sku,
        price: b.price,
        description: b.description,
        shortDescription: b.description.slice(0, 140),
        isDigital: b.mode !== "PHYSICAL_ONLY",
      },
      create: {
        name: b.name,
        slug: b.slug,
        sku: b.sku,
        productType: "BOOK",
        categoryId: booksCategory.id,
        price: b.price,
        description: b.description,
        shortDescription: b.description.slice(0, 140),
        stockQuantity: b.mode === "PDF_ONLY" ? 0 : 30,
        trackInventory: b.mode !== "PDF_ONLY",
        isActive: true,
        isDigital: b.mode !== "PHYSICAL_ONLY",
      },
    });

    await prisma.productBookDetails.upsert({
      where: { productId: product.id },
      update: {
        author: b.author,
        isbn: b.isbn,
        publisher: b.publisher,
        language: b.language,
        pageCount: b.pages,
      },
      create: {
        productId: product.id,
        author: b.author,
        isbn: b.isbn,
        publisher: b.publisher,
        language: b.language,
        pageCount: b.pages,
      },
    });

    const existingImage = await prisma.productImage.findFirst({ where: { productId: product.id } });
    if (!existingImage) {
      const url = await uploadPlaceholderImage(b.name, b.color);
      await upsertProductImage(product.id, url, `${b.name} cover`);
    }

    if (b.mode === "PHYSICAL_ONLY" || b.mode === "BOTH") {
      await upsertBookFormatOption(product.id, "PHYSICAL", {
        price: b.price,
        isActive: true,
        stockQuantity: 30,
        trackInventory: true,
        lowStockThreshold: 5,
        weightGrams: 350,
      });
    }

    if (b.mode === "PDF_ONLY" || b.mode === "BOTH") {
      const pdfPrice = b.mode === "PDF_ONLY" ? b.price : Math.round(b.price * 0.6);
      const existingPdfOption = await prisma.bookFormatOption.findUnique({
        where: { productId_format: { productId: product.id, format: "PDF" } },
      });
      const needsPdfUpload = !existingPdfOption || !existingPdfOption.pdfFileKey;
      const pdfFileKey = needsPdfUpload ? await savePdfBuffer(buildPlaceholderPdf(b.name)) : existingPdfOption.pdfFileKey;

      await upsertBookFormatOption(product.id, "PDF", {
        price: pdfPrice,
        isActive: true,
        maxDownloads: 5,
        expiryDays: 365,
        pdfFileKey,
        pdfOriginalName: `${b.slug}.pdf`,
      });
    }
  }
  console.log(`Seeded ${books.length} phase-seed book products (physical-only / PDF-only / both) under "Books".`);
}

// `npm run seed` always creates the first admin user — that's required for
// every environment, including production. It only seeds the demo catalog
// (placeholder books/products/collections) when explicitly opted into via
// SEED_DEMO_CATALOG=true or `npm run seed:demo`, so production launches
// never get populated with demo merchandising by accident.
// Best-effort guard against accidentally seeding a production database.
// Not foolproof — just a sanity check on the connection string shape.
function looksLikeProductionDatabaseUrl(databaseUrl) {
  if (!databaseUrl) return false;
  const isLocalHost = /(localhost|127\.0\.0\.1|::1)/i.test(databaseUrl);
  const looksDevOrTest = /(dev|test|local|staging)/i.test(databaseUrl);
  return !isLocalHost && !looksDevOrTest;
}

async function main() {
  await seedAdmin();
  if (process.env.SEED_DEMO_CATALOG === "true") {
    if (looksLikeProductionDatabaseUrl(process.env.DATABASE_URL)) {
      console.warn(
        "WARNING: DATABASE_URL does not look like a dev/test database and SEED_DEMO_CATALOG=true — skipping demo catalog seed as a safety precaution. Rename/tag the database with 'dev'/'test'/'staging' or point at localhost to proceed."
      );
      return;
    }
    await seedBooksCategoryAndProducts();
    await seedShopCategoriesAndProducts();
    await seedExpandedDemo();
    await seedPhaseSeedDemoCatalog();
  } else {
    console.log("SEED_DEMO_CATALOG is not 'true' — skipping demo catalog seed.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
