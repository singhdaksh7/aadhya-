// DEMO IMAGERY — tasteful, royalty-free photography sourced from Unsplash.
// Centralized so every page references the same verified, on-theme set.
// Each entry includes real alt text; SmartImage falls back to a generated
// placeholder automatically if a URL ever fails to load.

function unsplash(id, w = 1200, q = 75) {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=${q}`;
}

// Raw photo ids (Unsplash), reused thematically across sections.
const ids = {
  journalDesk: "1643148636637-58b3eb95cdad", // notebook, coffee, small plant on wood table
  counselling: "1573497620053-ea5300f94f21", // two women in calm conversation at table
  mindfulTalk: "1573497491208-6b1acb260507", // two women talking, bright window light
  vegetableFlatlay: "1590779033100-9f60a05a013d", // fresh colourful vegetables
  foodPrep: "1507048331197-7d4ac70811cf", // hands preparing fresh food outdoors
  researchDesk: "1578589335615-9e804277a5af", // books, coffee, laptop
  community: "1554902748-feaf536fc594", // small group collaborating at wooden table
  lifestyleTea: "1740177450034-5d019cc93d58", // tea, cosy blanket, warm light
  workshopGroup: "1720347274787-961f33ef151d", // small group workshop around a table
  ceramicVases: "1597696929736-6d13bed8e6a8", // collection of neutral ceramic vases
  candle: "1783005876092-7025151b853f", // glowing candle on dark table
  wovenHanging: "1776721977064-d4e5389db6b9", // macrame wall hanging, earthy tones
  ceramicTray: "1784901391108-d9a0f3911bea", // ceramic bowls on wooden serving tray
  ringVase: "1643569556871-91ec60671ed7", // neutral donut-shaped ceramic vase
  wickerBasket: "1562835154-7ac43f0fec10", // handwoven wicker basket, dried stems
  podcastMic: "1478737270239-2f02b77fc618", // condenser microphone in a quiet studio
};

function img(id, alt, w) {
  return { src: unsplash(id, w), alt };
}

export const images = {
  hero: img(ids.journalDesk, "Open notebook, coffee and a small plant on a warm wooden table", 1400),

  programs: {
    "counselling-skills-practice": img(ids.counselling, "Two people in a calm, supportive counselling-style conversation"),
    "therapeutic-nutrition-foundations": img(ids.vegetableFlatlay, "An assortment of fresh, colourful vegetables"),
    "personal-development-wellbeing": img(ids.journalDesk, "A notebook and coffee on a calm, warm workspace"),
    "research-professional-development": img(ids.researchDesk, "Books, coffee and a laptop on a research desk"),
    "mindful-communication-relationships": img(ids.mindfulTalk, "Two people in a mindful, attentive conversation"),
    "nutrition-for-everyday-energy": img(ids.foodPrep, "Hands preparing fresh, healthy food"),
  },

  consultations: {
    "counselling-session": img(ids.counselling, "Two people in a calm, private counselling conversation"),
    "therapeutic-diet-consultation": img(ids.foodPrep, "Fresh food preparation for a nutrition consultation"),
  },

  about: {
    community: img(ids.community, "A small group collaborating warmly around a table"),
  },

  research: {
    hero: img(ids.researchDesk, "Books, coffee and a laptop on an academic research desk"),
  },

  content: {
    Counselling: img(ids.counselling, "Two people in a calm conversation"),
    Nutrition: img(ids.vegetableFlatlay, "Fresh, colourful vegetables"),
    Wellbeing: img(ids.journalDesk, "A notebook and coffee in a calm workspace"),
    Research: img(ids.researchDesk, "Books and a laptop on a research desk"),
    Lifestyle: img(ids.lifestyleTea, "A warm cup of tea beside a cosy blanket"),
  },

  events: {
    workshop: img(ids.workshopGroup, "A small group in an informal workshop setting"),
  },

  products: {
    p1: img(ids.wovenHanging, "A handwoven macrame wall hanging in earthy tones"),
    p2: img(ids.ringVase, "A neutral-toned handcrafted ceramic vase"),
    p3: img(ids.ceramicTray, "Ceramic bowls arranged on a wooden serving tray"),
    p4: img(ids.ceramicVases, "A curated collection of ceramic vases in neutral tones"),
    p5: img(ids.candle, "A hand-poured candle glowing warmly on a table"),
    p6: img(ids.wickerBasket, "A handcrafted wicker basket with natural dried stems"),
  },

  shopHero: img(ids.ceramicVases, "A collection of handcrafted ceramic vases in neutral tones"),

  thinkpod: {
    featured: img(ids.podcastMic, "A condenser microphone in a quiet studio setting"),
    talk: img(ids.researchDesk, "Books, coffee and a laptop — a research conversation setting"),
    insight: img(ids.lifestyleTea, "A warm cup of tea in a calm setting"),
  },

  finalCta: img(ids.lifestyleTea, "A warm cup of tea beside a cosy blanket", 1600),
};
