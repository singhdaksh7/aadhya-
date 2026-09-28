import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
let saveBuffer;
let savePdfBuffer;
let pdfExists;

const AUTHORIZATION_VALUE = "YES";
const BOOK_CATEGORY = { name: "Books", slug: "books", sortOrder: 0 };

const categories = [
  { name: "Home Decor", slug: "home-decor", sortOrder: 1 },
  { name: "Home Textiles", slug: "home-textiles", sortOrder: 2 },
  BOOK_CATEGORY,
];

const physicalProducts = [
  {
    name: "Handcrafted Terracotta Diya Set",
    slug: "handcrafted-terracotta-diya-set",
    sku: "AADYA-DIYA-001",
    categorySlug: "home-decor",
    price: 799,
    salePrice: 649,
    stockQuantity: 40,
    shortDescription: "Set of six hand-shaped terracotta diyas.",
    description: "A set of six hand-shaped terracotta diyas, fired and finished in earthy tones for a warm, grounded festive table.",
    tags: ["terracotta", "diya", "handcrafted", "festive"],
    flags: { isFeatured: true, isNewArrival: true, isBestSeller: false },
    color: "#B65D3C",
  },
  {
    name: "Linen Cushion Cover",
    slug: "linen-cushion-cover",
    sku: "AADYA-LINEN-002",
    categorySlug: "home-textiles",
    price: 999,
    salePrice: null,
    stockQuantity: 60,
    shortDescription: "Stonewashed linen cushion cover in a soft neutral tone.",
    description: "A breathable, stonewashed linen cushion cover with a concealed zip and an unassuming, everyday finish.",
    tags: ["linen", "cushion", "home-textiles"],
    flags: { isFeatured: false, isNewArrival: true, isBestSeller: true },
    color: "#897D69",
  },
  {
    name: "Artisan Ceramic Vase",
    slug: "artisan-ceramic-vase",
    sku: "AADYA-VASE-003",
    categorySlug: "home-decor",
    price: 1450,
    salePrice: 1290,
    stockQuantity: 25,
    shortDescription: "Hand-thrown ceramic vase with a matte glaze.",
    description: "A hand-thrown ceramic vase with a matte glaze and a subtly irregular silhouette, made for fresh or dried stems.",
    tags: ["ceramic", "vase", "home-decor"],
    flags: { isFeatured: true, isNewArrival: false, isBestSeller: true },
    color: "#52705D",
  },
];

const books = [
  {
    name: "The Art of Slow Living",
    slug: "the-art-of-slow-living",
    sku: "AADYA-BOOK-001",
    physical: { price: 599, stockQuantity: 30, weightGrams: 320 },
    author: "Aadya Editorial Collective (Demo Sample)",
    isbn: "AADYA-DEMO-ISBN-0001",
    publisher: "Aadya Sample Press",
    language: "English",
    pageCount: 184,
    color: "#3F506B",
  },
  {
    name: "Aadya Home Styling Guide",
    slug: "aadya-home-styling-guide",
    sku: "AADYA-BOOK-002",
    pdf: { price: 349 },
    author: "Aadya Editorial Collective (Demo Sample)",
    isbn: "AADYA-DEMO-ISBN-0002",
    publisher: "Aadya Sample Press",
    language: "English",
    pageCount: 96,
    color: "#705485",
  },
  {
    name: "Spaces of Stillness",
    slug: "spaces-of-stillness",
    sku: "AADYA-BOOK-003",
    physical: { price: 699, stockQuantity: 30, weightGrams: 380 },
    pdf: { price: 419 },
    author: "Aadya Editorial Collective (Demo Sample)",
    isbn: "AADYA-DEMO-ISBN-0003",
    publisher: "Aadya Sample Press",
    language: "English",
    pageCount: 220,
    color: "#8B5C48",
  },
];

function escapeXml(value) {
  return String(value).replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character]);
}

function placeholderArtwork(label, color, isCover = false) {
  const width = 1200;
  const height = isCover ? 1800 : 900;
  const safeLabel = escapeXml(label);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
      `<rect width="100%" height="100%" fill="${color}"/>` +
      `<circle cx="${width / 2}" cy="${height * 0.38}" r="150" fill="#ffffff" fill-opacity="0.12"/>` +
      `<text x="${width / 2}" y="${height * 0.62}" fill="#ffffff" font-family="serif" font-size="54" text-anchor="middle">${safeLabel}</text>` +
      `<text x="${width / 2}" y="${height * 0.68}" fill="#ffffff" fill-opacity="0.82" font-family="sans-serif" font-size="24" text-anchor="middle">Original Aadya sample artwork</text>` +
      `</svg>`,
    "utf8"
  );
}

// A small, valid PDF generated without external content or dependencies.
function buildDemoPdf(title) {
  const lines = ["Aadya Demo Digital Book", "Sample content for testing digital fulfilment.", title];
  const stream = `BT /F1 18 Tf 72 720 Td (${lines[0]}) Tj 0 -32 Td /F1 13 Tf (${lines[1]}) Tj 0 -44 Td /F1 16 Tf (${lines[2]}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
  ];
  let document = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(document, "utf8"));
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(document, "utf8");
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) document += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(document, "utf8");
}

async function upsertCategory(category) {
  return prisma.category.upsert({
    where: { slug: category.slug },
    update: {},
    create: { ...category, isActive: true },
  });
}

async function findOrCreateProduct(data) {
  const existing = await prisma.product.findUnique({ where: { slug: data.slug } });
  if (existing) return existing;
  const skuOwner = await prisma.product.findUnique({ where: { sku: data.sku } });
  if (skuOwner) throw new Error(`Refusing to seed ${data.slug}: SKU ${data.sku} belongs to another product.`);
  return prisma.product.create({ data });
}

async function createPrimaryImageIfMissing(product, label, color, isCover = false) {
  const primary = await prisma.productImage.findFirst({ where: { productId: product.id, isPrimary: true } });
  if (primary) return false;
  const url = await saveBuffer(placeholderArtwork(label, color, isCover), "image/svg+xml");
  await prisma.productImage.create({ data: { productId: product.id, url, altText: isCover ? `${label} cover` : label, isPrimary: true, sortOrder: 0 } });
  return true;
}

async function createFormatIfMissing(productId, format, data) {
  return prisma.bookFormatOption.upsert({
    where: { productId_format: { productId, format } },
    update: {},
    create: { productId, format, ...data },
  });
}

async function ensurePdfFormat(product, book) {
  const existing = await prisma.bookFormatOption.findUnique({ where: { productId_format: { productId: product.id, format: "PDF" } } });
  if (existing?.pdfFileKey) {
    return { key: existing.pdfFileKey, created: false };
  }
  const key = await savePdfBuffer(buildDemoPdf(book.name));
  if (!(await pdfExists(key))) throw new Error(`PDF storage verification failed for ${book.slug}.`);
  await prisma.bookFormatOption.upsert({
    where: { productId_format: { productId: product.id, format: "PDF" } },
    update: { pdfFileKey: key, pdfOriginalName: `${book.slug}.pdf` },
    create: {
      productId: product.id,
      format: "PDF",
      price: book.pdf.price,
      pdfFileKey: key,
      pdfOriginalName: `${book.slug}.pdf`,
      maxDownloads: 5,
      expiryDays: 365,
      isActive: true,
    },
  });
  return { key, created: true };
}

async function main() {
  if (process.env.ALLOW_PRODUCTION_CATALOG_SEED !== AUTHORIZATION_VALUE) {
    console.error("Production catalog seed not authorized.");
    process.exitCode = 1;
    return;
  }
  ({ saveBuffer, savePdfBuffer, pdfExists } = await import("../src/modules/uploads/storage.js"));

  const categoryBySlug = new Map();
  for (const category of categories) categoryBySlug.set(category.slug, await upsertCategory(category));

  let imagesCreated = 0;
  for (const item of physicalProducts) {
    const { categorySlug, flags, color, ...productData } = item;
    const product = await findOrCreateProduct({
      ...productData,
      categoryId: categoryBySlug.get(categorySlug).id,
      productType: "PHYSICAL",
      trackInventory: true,
      isActive: true,
      isFeatured: flags.isFeatured,
      isNewArrival: flags.isNewArrival,
      isBestSeller: flags.isBestSeller,
    });
    if (await createPrimaryImageIfMissing(product, item.name, color)) imagesCreated += 1;
  }

  let pdfsCreated = 0;
  const pdfKeys = [];
  for (const book of books) {
    const product = await findOrCreateProduct({
      name: book.name,
      slug: book.slug,
      sku: book.sku,
      categoryId: categoryBySlug.get(BOOK_CATEGORY.slug).id,
      productType: "BOOK",
      price: book.physical?.price ?? book.pdf.price,
      stockQuantity: book.physical?.stockQuantity ?? 0,
      trackInventory: Boolean(book.physical),
      isDigital: Boolean(book.pdf),
      isActive: true,
      shortDescription: "Aadya demo/sample book for catalog and fulfilment testing.",
      description: "Aadya demo/sample content only. This original placeholder title is for production catalog and fulfilment testing.",
      tags: ["aadya-sample", "book"],
    });
    await prisma.productBookDetails.upsert({
      where: { productId: product.id },
      update: {},
      create: { productId: product.id, author: book.author, isbn: book.isbn, publisher: book.publisher, language: book.language, pageCount: book.pageCount, edition: "Aadya demo/sample edition" },
    });
    if (await createPrimaryImageIfMissing(product, book.name, book.color, true)) imagesCreated += 1;
    if (book.physical) await createFormatIfMissing(product.id, "PHYSICAL", { ...book.physical, trackInventory: true, lowStockThreshold: 5, isActive: true });
    if (book.pdf) {
      const pdf = await ensurePdfFormat(product, book);
      pdfKeys.push(pdf.key);
      if (pdf.created) pdfsCreated += 1;
    }
  }

  for (const key of pdfKeys) {
    if (!(await pdfExists(key))) throw new Error("A seeded PDF could not be verified in private storage.");
  }
  console.log(`Production catalog seed complete: 6 products, ${imagesCreated} image(s) created, ${pdfsCreated} PDF file(s) created.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
