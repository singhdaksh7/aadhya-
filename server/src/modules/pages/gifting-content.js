import { z } from "zod";

export const GIFTING_HERO_DEFAULTS = {
  eyebrow: "Artisan Gifting",
  title: "Thoughtful gifts, handmade with heart.",
  description: "Curated heirloom keepsakes, handcrafted decor, and slow living treasures wrapped in mindful packaging for life's meaningful moments.",
  desktopImage: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=1800&auto=format&fit=crop",
  mobileImage: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=800&auto=format&fit=crop",
  ctaLabel: "Explore All Gifts",
  ctaUrl: "/collections/festive-gifting",
};

export const GIFTS_BY_OCCASION_DEFAULTS = {
  eyebrow: "Celebrate Milestones",
  cardCtaLabel: "Explore",
  heading: "Gifts by Occasion",
  subtitle: "Find the perfect handcrafted piece to celebrate every milestone.",
  items: [
    {
      id: "occ-1",
      title: "House Warming",
      image: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=800&auto=format&fit=crop",
      destinationUrl: "/shop/category/home-decor",
      sortOrder: 1,
      enabled: true,
    },
    {
      id: "occ-2",
      title: "Birthday Celebrations",
      image: "https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=800&auto=format&fit=crop",
      destinationUrl: "/shop/category/gifts",
      sortOrder: 2,
      enabled: true,
    },
    {
      id: "occ-3",
      title: "Wedding Keepsakes",
      image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=800&auto=format&fit=crop",
      destinationUrl: "/collections/festive-gifting",
      sortOrder: 3,
      enabled: true,
    },
    {
      id: "occ-4",
      title: "Anniversary Gifts",
      image: "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?q=80&w=800&auto=format&fit=crop",
      destinationUrl: "/collections/earth-collection",
      sortOrder: 4,
      enabled: true,
    },
    {
      id: "occ-5",
      title: "Gifts Under ₹2,000",
      image: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?q=80&w=800&auto=format&fit=crop",
      destinationUrl: "/shop?maxPrice=2000",
      sortOrder: 5,
      enabled: true,
    },
    {
      id: "occ-6",
      title: "Gifts Under ₹5,000",
      image: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=800&auto=format&fit=crop",
      destinationUrl: "/shop?maxPrice=5000",
      sortOrder: 6,
      enabled: true,
    },
    {
      id: "occ-7",
      title: "Corporate & Client Gifts",
      image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=800&auto=format&fit=crop",
      destinationUrl: "/contact",
      sortOrder: 7,
      enabled: true,
    },
    {
      id: "occ-8",
      title: "Festive & Spiritual",
      image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=800&auto=format&fit=crop",
      destinationUrl: "/collections/festive-gifting",
      sortOrder: 8,
      enabled: true,
    },
  ],
};

export const CURATED_STORIES_DEFAULTS = {
  eyebrow: "Artisan Narratives",
  storyLabel: "Story",
  heading: "Curated Gifting Stories",
  subtitle: "Thoughtfully themed edits designed to inspire heartfelt connections.",
  stories: [
    {
      id: "story-1",
      heading: "For Peaceful Sanctuaries",
      description: "Cast-brass oil lamps, aromatic sandalwood reed diffusers, and soothing soapstone objects designed to cultivate calm within home retreats.",
      image: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?q=80&w=1000&auto=format&fit=crop",
      ctaLabel: "Explore Calming Edits",
      destinationUrl: "/collections/mindful-spaces",
      sortOrder: 1,
      enabled: true,
    },
    {
      id: "story-2",
      heading: "From Indian Hands with Love",
      description: "Heirloom metal craft, master dhokra figurines, and terracotta pottery directly celebrating heritage artisan clusters across India.",
      image: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=1000&auto=format&fit=crop",
      ctaLabel: "Discover Artisan Roots",
      destinationUrl: "/collections/handcrafted-living",
      sortOrder: 2,
      enabled: true,
    },
    {
      id: "story-3",
      heading: "Friends, Family & Gatherings",
      description: "Artisan-thrown serving bowls, handwoven textiles, and dining accents created for sharing quiet feasts and festive teas.",
      image: "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?q=80&w=1000&auto=format&fit=crop",
      ctaLabel: "Shop Dining & Living",
      destinationUrl: "/shop/category/home-decor",
      sortOrder: 3,
      enabled: true,
    },
    {
      id: "story-4",
      heading: "Editorial Reads & Monographs",
      description: "Hardcover design volumes and journals on mindful interior architecture and slow heritage craft to enrich bedside and coffee tables.",
      image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=1000&auto=format&fit=crop",
      ctaLabel: "Explore Books",
      destinationUrl: "/books",
      sortOrder: 4,
      enabled: true,
    },
  ],
};

export const GIFTS_BY_FESTIVAL_DEFAULTS = {
  eyebrow: "Festive Celebrations",
  cardCtaLabel: "View Festive Edit",
  heading: "Gifts by Festival",
  subtitle: "Honoring India's celebrations with mindful craft and luminous light.",
  items: [
    {
      id: "fest-1",
      label: "Diwali Lights",
      image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=600&auto=format&fit=crop",
      destinationUrl: "/collections/festive-gifting",
      sortOrder: 1,
      enabled: true,
    },
    {
      id: "fest-2",
      label: "Wedding Season",
      image: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=600&auto=format&fit=crop",
      destinationUrl: "/collections/handcrafted-living",
      sortOrder: 2,
      enabled: true,
    },
    {
      id: "fest-3",
      label: "House & Griha Pravesh",
      image: "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?q=80&w=600&auto=format&fit=crop",
      destinationUrl: "/shop/category/home-decor",
      sortOrder: 3,
      enabled: true,
    },
    {
      id: "fest-4",
      label: "New Year & Beginnings",
      image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=600&auto=format&fit=crop",
      destinationUrl: "/books",
      sortOrder: 4,
      enabled: true,
    },
  ],
};

export const GIFTING_BENEFITS_DEFAULTS = {
  eyebrow: "Care in Every Box",
  heading: "The Tushaqsa Gifting Promise",
  subtitle: "Every gift is treated with reverence, care, and attention to detail.",
  cards: [
    {
      id: "gb-1",
      title: "Thoughtfully Packaged",
      description: "Packed with clean, protective materials and presented with considered simplicity.",
      icon: "gift",
      enabled: true,
      sortOrder: 1,
    },
    {
      id: "gb-2",
      title: "Handmade in India",
      description: "Authentic objects shaped by multigenerational craft communities and master artisans.",
      icon: "heart",
      enabled: true,
      sortOrder: 2,
    },
    {
      id: "gb-3",
      title: "Reliable Pan-India Delivery",
      description: "Orders dispatched within {{dispatchEstimate}} with full tracking from our studio to your recipient.",
      icon: "truck",
      enabled: true,
      sortOrder: 3,
    },
  ],
};

export const GIFTS_BY_CRAFT_DEFAULTS = {
  eyebrow: "Artisanal Materials",
  cardCtaLabel: "Explore Craft",
  heading: "Shop Gifts by Craft",
  subtitle: "Explore timeless creations categorized by human skill and material purity.",
  crafts: [
    {
      id: "cr-1",
      title: "Sand-Cast Brass & Bronze",
      image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=800&auto=format&fit=crop",
      destinationUrl: "/shop?search=brass",
      sortOrder: 1,
      enabled: true,
    },
    {
      id: "cr-2",
      title: "Raw Terracotta & Clay",
      image: "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?q=80&w=800&auto=format&fit=crop",
      destinationUrl: "/collections/earth-collection",
      sortOrder: 2,
      enabled: true,
    },
    {
      id: "cr-3",
      title: "Natural Fibers & Handwoven Linen",
      image: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?q=80&w=800&auto=format&fit=crop",
      destinationUrl: "/shop/category/home-decor",
      sortOrder: 3,
      enabled: true,
    },
    {
      id: "cr-4",
      title: "Handcrafted Living & Stone",
      image: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=800&auto=format&fit=crop",
      destinationUrl: "/collections/handcrafted-living",
      sortOrder: 4,
      enabled: true,
    },
  ],
};

export const FEATURED_GIFTS_DEFAULTS = {
  heading: "Handpicked Gifts",
  eyebrow: "Artisan Selection",
  subtitle: "Signature decor pieces chosen for their presence, beauty, and timeless resonance.",
  sourceMode: "AUTO",
  collectionSlug: "festive-gifting",
  productIds: [],
  limit: 4,
  ctaLabel: "View All Gift Pieces",
  ctaUrl: "/shop",
};

export const GIFTS_BY_BUDGET_DEFAULTS = {
  eyebrow: "Considered Values",
  cardCtaLabel: "Explore Collection",
  tierLabel: "Tier",
  heading: "Gifts by Budget",
  subtitle: "Quiet luxury curated for every gifting plan.",
  tiers: [
    {
      id: "b-1",
      label: "Under ₹1,000",
      description: "Small mindful gestures & everyday ceramics",
      destinationUrl: "/shop?maxPrice=1000",
      sortOrder: 1,
      enabled: true,
    },
    {
      id: "b-2",
      label: "Under ₹2,000",
      description: "Hand-poured fragrances, books & tabletop decor",
      destinationUrl: "/shop?maxPrice=2000",
      sortOrder: 2,
      enabled: true,
    },
    {
      id: "b-3",
      label: "Under ₹3,500",
      description: "Cast-brass oil lamps & linen home textiles",
      destinationUrl: "/shop?maxPrice=3500",
      sortOrder: 3,
      enabled: true,
    },
    {
      id: "b-4",
      label: "Premium Heirloom",
      description: "Artisan statements & collector craft objects",
      destinationUrl: "/collections/handcrafted-living",
      sortOrder: 4,
      enabled: true,
    },
  ],
};

export const GIFTING_SEO_DEFAULTS = {
  heading: "The Art of Mindful & Handcrafted Gifting",
  content: `<p>In a world of mass-produced goods, giving a handcrafted object connects giver, recipient, and artisan in a shared story of patience, beauty, and care. At Tushaqsa, every piece is shaped from natural materials—unvarnished terracotta, sand-cast brass, unbleached flax, and aromatic botanicals.</p><p>Whether honoring a wedding, welcoming friends into a new sanctuary, or celebrating a festive evening, our gifting collection offers items of enduring presence that grow more cherished with time.</p>`,
};

export const GIFTING_FAQ_DEFAULTS = {
  eyebrow: "Help & Assurance",
  heading: "Frequently Asked Questions About Gifting",
  subtitle: "Clear answers to help you send thoughtful presents seamlessly.",
  items: [
    {
      id: "faq-1",
      question: "Can I send a gift directly to the recipient?",
      answer: "Yes. Simply provide the recipient's delivery address at checkout. We pack each piece securely so it arrives in presentation-ready condition.",
      sortOrder: 1,
      enabled: true,
    },
    {
      id: "faq-2",
      question: "Can I include a personalized gift note?",
      answer: "You can specify gift instructions or a personalized message in the order notes during checkout, and our studio team will print it with care.",
      sortOrder: 2,
      enabled: true,
    },
    {
      id: "faq-3",
      question: "How long does delivery take for gift orders?",
      answer: "Orders are prepared and dispatched within {{dispatchEstimate}}, and typically arrive within {{deliveryEstimate}} across India.",
      sortOrder: 3,
      enabled: true,
    },
    {
      id: "faq-4",
      question: "Do you offer corporate or bulk celebratory orders?",
      answer: "Yes, we support bespoke corporate, wedding, and festive bulk orders. Please reach out to us via our Contact page for customized timelines and requests.",
      sortOrder: 4,
      enabled: true,
    },
    {
      id: "faq-5",
      question: "What is your return policy on gift items?",
      answer: "Standard orders qualify for returns within {{returnWindowDays}} days of receipt in accordance with our store policy. Custom and personalized items are final sale.",
      sortOrder: 5,
      enabled: true,
    },
  ],
};

const safeUrl = z.string().trim().max(2048).refine((v) => v.startsWith("/") || /^https?:\/\//i.test(v), "Must be a relative or http(s) URL");
const optionalUrl = z.union([safeUrl, z.literal("")]).optional();
const text = (max) => z.string().trim().max(max);
const optionalText = (max) => z.union([text(max), z.literal("")]).optional();

export const giftingHeroSchema = z.object({
  eyebrow: optionalText(120),
  title: text(200),
  description: optionalText(800),
  desktopImage: optionalUrl,
  mobileImage: optionalUrl,
  ctaLabel: optionalText(80),
  ctaUrl: optionalUrl,
});

export const giftsByOccasionSchema = z.object({
  eyebrow: optionalText(120),
  cardCtaLabel: optionalText(60),
  heading: text(160),
  subtitle: optionalText(400),
  items: z.array(z.object({
    id: optionalText(100),
    title: text(120),
    image: optionalUrl,
    destinationUrl: optionalUrl,
    sortOrder: z.number().int().min(0).max(1000).optional(),
    enabled: z.boolean().optional(),
  })).max(20),
});

export const curatedStoriesSchema = z.object({
  eyebrow: optionalText(120),
  storyLabel: optionalText(40),
  heading: text(160),
  subtitle: optionalText(400),
  stories: z.array(z.object({
    id: optionalText(100),
    heading: text(160),
    description: optionalText(600),
    image: optionalUrl,
    ctaLabel: optionalText(80),
    destinationUrl: optionalUrl,
    // AUTO alternates image side by position; the others pin the orientation for that story.
    layout: z.enum(["AUTO", "IMAGE_LEFT", "IMAGE_RIGHT", "IMAGE_TOP"]).optional(),
    sortOrder: z.number().int().min(0).max(1000).optional(),
    enabled: z.boolean().optional(),
  })).max(10),
});

export const giftsByFestivalSchema = z.object({
  eyebrow: optionalText(120),
  cardCtaLabel: optionalText(60),
  heading: text(160),
  subtitle: optionalText(400),
  items: z.array(z.object({
    id: optionalText(100),
    label: text(120),
    image: optionalUrl,
    destinationUrl: optionalUrl,
    sortOrder: z.number().int().min(0).max(1000).optional(),
    enabled: z.boolean().optional(),
  })).max(20),
});

export const giftingBenefitsSchema = z.object({
  eyebrow: optionalText(120),
  heading: text(160),
  subtitle: optionalText(400),
  cards: z.array(z.object({
    id: optionalText(100),
    title: text(120),
    description: optionalText(400),
    icon: optionalText(40),
    image: optionalUrl,
    sortOrder: z.number().int().min(0).max(1000).optional(),
    enabled: z.boolean().optional(),
  })).max(6),
});

export const giftsByCraftSchema = z.object({
  eyebrow: optionalText(120),
  cardCtaLabel: optionalText(60),
  heading: text(160),
  subtitle: optionalText(400),
  crafts: z.array(z.object({
    id: optionalText(100),
    title: text(120),
    image: optionalUrl,
    destinationUrl: optionalUrl,
    sortOrder: z.number().int().min(0).max(1000).optional(),
    enabled: z.boolean().optional(),
  })).max(12),
});

export const featuredGiftsSchema = z.object({
  heading: text(160),
  eyebrow: optionalText(120),
  subtitle: optionalText(400),
  // AUTO = products flagged Featured; MANUAL = hand-picked productIds; COLLECTION = a collection;
  // QUERY = a dynamic catalog query (category / search / price range / sort).
  sourceMode: z.enum(["AUTO", "MANUAL", "COLLECTION", "QUERY"]).optional(),
  collectionSlug: optionalText(100),
  productIds: z.array(z.union([text(100), z.null(), z.literal("")])).max(24).optional(),
  queryCategory: optionalText(140),
  querySearch: optionalText(200),
  queryMinPrice: z.number().min(0).max(10000000).nullable().optional(),
  queryMaxPrice: z.number().min(0).max(10000000).nullable().optional(),
  querySort: z.enum(["newest", "price_asc", "price_desc", "name_asc"]).optional(),
  limit: z.number().int().min(1).max(24).optional(),
  ctaLabel: optionalText(80),
  ctaUrl: optionalUrl,
});

export const giftsByBudgetSchema = z.object({
  eyebrow: optionalText(120),
  cardCtaLabel: optionalText(60),
  tierLabel: optionalText(40),
  heading: text(160),
  subtitle: optionalText(400),
  tiers: z.array(z.object({
    id: optionalText(100),
    label: text(120),
    description: optionalText(300),
    destinationUrl: optionalUrl,
    // When a URL is left blank the storefront links to /shop filtered by this price range.
    minPrice: z.number().min(0).max(10000000).nullable().optional(),
    maxPrice: z.number().min(0).max(10000000).nullable().optional(),
    sortOrder: z.number().int().min(0).max(1000).optional(),
    enabled: z.boolean().optional(),
  })).max(10),
});

export const giftingSeoSchema = z.object({
  eyebrow: optionalText(120),
  heading: text(200),
  content: optionalText(5000),
});

export const giftingFaqSchema = z.object({
  eyebrow: optionalText(120),
  heading: text(160),
  subtitle: optionalText(400),
  items: z.array(z.object({
    id: optionalText(100),
    question: text(240),
    answer: optionalText(1000),
    sortOrder: z.number().int().min(0).max(1000).optional(),
    enabled: z.boolean().optional(),
  })).max(20),
});

export const DEFAULT_GIFTING_PAGE_SECTIONS = [
  { type: "GIFTING_HERO", name: "Gifting Hero", sortOrder: 1, settings: GIFTING_HERO_DEFAULTS },
  { type: "GIFTS_BY_OCCASION", name: "Gifts by Occasion", sortOrder: 2, settings: GIFTS_BY_OCCASION_DEFAULTS },
  { type: "CURATED_STORIES", name: "Curated Gifting Stories", sortOrder: 3, settings: CURATED_STORIES_DEFAULTS },
  { type: "GIFTS_BY_FESTIVAL", name: "Gifts by Festival", sortOrder: 4, settings: GIFTS_BY_FESTIVAL_DEFAULTS },
  { type: "GIFTING_BENEFITS", name: "Gifting Service Strip", sortOrder: 5, settings: GIFTING_BENEFITS_DEFAULTS },
  { type: "GIFTS_BY_CRAFT", name: "Gifts by Craft", sortOrder: 6, settings: GIFTS_BY_CRAFT_DEFAULTS },
  { type: "FEATURED_GIFTS", name: "Featured Handpicked Gifts", sortOrder: 7, settings: FEATURED_GIFTS_DEFAULTS },
  { type: "GIFTS_BY_BUDGET", name: "Gifts by Budget", sortOrder: 8, settings: GIFTS_BY_BUDGET_DEFAULTS },
  { type: "GIFTING_SEO", name: "Gifting SEO Story", sortOrder: 9, settings: GIFTING_SEO_DEFAULTS },
  { type: "GIFTING_FAQ", name: "Gifting FAQ Accordion", sortOrder: 10, settings: GIFTING_FAQ_DEFAULTS },
];
