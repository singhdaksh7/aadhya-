import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/utils/password.js";

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
async function seedExpandedDemo() {
  const categories = new Map();
  for (const [name, sortOrder] of [["Textiles", 4], ["Lighting", 5], ["Books", 0], ["Home Decor", 1], ["Wellness Decor", 2], ["Handcrafted Accessories", 3]]) categories.set(name, await upsertCategory({ name, sortOrder }));
  const physical = [...legacyProducts.map((p) => `${p.name}|${p.category}`), ...extraPhysical];
  const variants = { "Decor Cushion": [["Small", "CUSHION-S", 12, 899], ["Large", "CUSHION-L", 8, 1299]], "Ceramic Vase": [["Ivory", "VASE-IVORY", 10, 1890], ["Sage", "VASE-SAGE", 7, 1950]], "Woven Throw": [["Natural", "THROW-NAT", 9, 1490], ["Terracotta", "THROW-TERR", 6, 1590]], "Terracotta Lamp": [["Short", "LAMP-SHORT", 5, 2100], ["Tall", "LAMP-TALL", 4, 2700]] };
  for (let i = 0; i < physical.length; i++) { const [name, categoryName] = physical[i].split("|"); const slug = slugify(name); let product = await prisma.product.findUnique({ where: { slug } }); if (!product) product = await prisma.product.create({ data: { name, slug, shortDescription: `Demo ${name} for Aadya merchandising.`, description: `Demo-only ${name}; safe placeholder catalog content.`, productType: "PHYSICAL", categoryId: categories.get(categoryName).id, sku: `DEMO-P-${String(i + 1).padStart(2, "0")}`, price: 900 + i * 75, stockQuantity: 20, isFeatured: i < 4, isBestSeller: i % 5 === 0, isNewArrival: i % 4 === 0, attributes: { material: "Demo material", collection: "Aadya demo" } } }); if (variants[name]) for (const [variantName, sku, stockQuantity, priceOverride] of variants[name]) await prisma.productVariant.upsert({ where: { sku }, update: {}, create: { productId: product.id, name: variantName, sku, stockQuantity, priceOverride, attributes: { option: variantName } } }); }
  for (let i = 0; i < extraBooks.length; i++) { const name = `${extraBooks[i]} (Demo Title)`; const slug = slugify(name.replace("(Demo Title)", "")); if (!await prisma.product.findUnique({ where: { slug } })) await prisma.product.create({ data: { name, slug, shortDescription: "Demo book catalogue entry.", description: "Demo-only original placeholder book data without cover artwork.", productType: "BOOK", categoryId: categories.get("Books").id, sku: `DEMO-B-${i + 4}`, price: 399 + i * 20, stockQuantity: 25, isFeatured: i < 2, isBestSeller: i % 3 === 0, isNewArrival: i % 2 === 0, bookDetail: { create: { author: "Aadya Demo Author", language: "English", pageCount: 160 + i * 8 } } } }); }
  const products = await prisma.product.findMany({ orderBy: { createdAt: "asc" } });
  for (const [index, title] of ["New Arrivals", "Best Sellers", "Home Sanctuary", "Reading Room"].entries()) { const collection = await prisma.collection.upsert({ where: { slug: slugify(title) }, update: { isActive: true, sortOrder: index }, create: { title, slug: slugify(title), description: `Demo ${title} collection`, isActive: true, sortOrder: index } }); for (const [position, product] of products.filter((p) => index === 3 ? p.productType === "BOOK" : index === 1 ? p.isBestSeller : index === 0 ? p.isNewArrival : p.productType === "PHYSICAL").slice(0, 12).entries()) await prisma.collectionProduct.upsert({ where: { collectionId_productId: { collectionId: collection.id, productId: product.id } }, update: { sortOrder: position }, create: { collectionId: collection.id, productId: product.id, sortOrder: position } }); }
}

async function main() {
  await seedAdmin();
  await seedBooksCategoryAndProducts();
  await seedShopCategoriesAndProducts();
  await seedExpandedDemo();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
