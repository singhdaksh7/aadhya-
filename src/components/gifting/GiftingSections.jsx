import React, { useState } from "react";
import { Link } from "react-router-dom";
import ProductCard from "../ProductCard";
import { resolveProductImageUrl } from "../../lib/api";
import { IconArrowRight, IconCheck } from "../icons";
import { scriptCase } from "../HeroBannerCarousel";
import RichTextRenderer from "../cms/RichTextRenderer";
import { interpolateCommercial, commercialContext } from "../../lib/commercialText";
import { useSiteSettings } from "../../hooks/useSiteSettings";

const route = (value, fallback = "/shop") =>
  typeof value === "string" && (value.startsWith("/") || /^https?:\/\//i.test(value)) ? value : fallback;

function SafeLink({ to, children, ...props }) {
  const url = route(to);
  return url.startsWith("/") ? (
    <Link to={url} {...props}>
      {children}
    </Link>
  ) : (
    <a href={url} {...props}>
      {children}
    </a>
  );
}

/** Resolves where a story's image sits: AUTO alternates by position, otherwise the CMS layout wins. */
export function storyImageSide(layout, index) {
  if (layout === "IMAGE_LEFT") return "left";
  if (layout === "IMAGE_RIGHT") return "right";
  if (layout === "IMAGE_TOP") return "top";
  return index % 2 === 0 ? "right" : "left";
}

/** Budget tier link: explicit URL wins, otherwise /shop filtered by the configured price range. */
export function budgetTierUrl(tier = {}) {
  if (typeof tier.destinationUrl === "string" && tier.destinationUrl.trim()) return tier.destinationUrl.trim();
  const params = new URLSearchParams();
  if (typeof tier.minPrice === "number" && tier.minPrice > 0) params.set("minPrice", String(tier.minPrice));
  if (typeof tier.maxPrice === "number" && tier.maxPrice > 0) params.set("maxPrice", String(tier.maxPrice));
  const qs = params.toString();
  return qs ? `/shop?${qs}` : "/shop";
}

// SECTION 1 — GIFTING HERO
export function GiftingHeroSection({ section }) {
  const content = section.settings || section.content || {};
  if (!content.title && !content.desktopImage) return null;

  const bgImg = resolveProductImageUrl(content.desktopImage);
  const mobileImg = resolveProductImageUrl(content.mobileImage) || bgImg;

  return (
    <section data-testid="gifting-hero" className="relative w-full overflow-hidden store-bg">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-8 py-10 sm:py-16">
        <div className="relative overflow-hidden rounded-3xl border store-border store-surface shadow-xs">
          {bgImg && (
            <div className="absolute inset-0">
              <picture>
                {mobileImg && <source media="(max-width: 640px)" srcSet={mobileImg} />}
                <img
                  src={bgImg}
                  alt={content.title || "Gifting at Tushaqsa"}
                  className="h-full w-full object-cover object-center brightness-[0.70]"
                  loading="eager"
                />
              </picture>
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal/90 via-charcoal/40 to-transparent sm:bg-gradient-to-r sm:from-charcoal/90 sm:via-charcoal/50 sm:to-transparent" />
            </div>
          )}

          <div className="relative z-10 flex min-h-[380px] sm:min-h-[460px] max-w-2xl flex-col justify-end p-6 sm:p-14 text-white">
            {content.eyebrow && (
              <span
                data-testid="gifting-hero-eyebrow"
                className="font-script text-2xl sm:text-4xl text-white/95 mb-2"
              >
                {scriptCase(content.eyebrow)}
              </span>
            )}
            <h1
              data-testid="gifting-hero-title"
              className="font-serif-display text-3xl sm:text-5xl lg:text-6xl font-normal leading-tight tracking-tight text-white"
            >
              {content.title}
            </h1>
            {content.description && (
              <p
                data-testid="gifting-hero-desc"
                className="mt-4 text-xs sm:text-base leading-relaxed text-white/85 max-w-xl"
              >
                {content.description}
              </p>
            )}
            {content.ctaLabel && (
              <div className="mt-8">
                <SafeLink
                  to={content.ctaUrl || "/shop"}
                  data-testid="gifting-hero-cta"
                  className="inline-flex items-center gap-2 rounded-full store-bg-primary px-7 py-3 text-xs font-semibold uppercase tracking-wider text-white shadow-md transition store-primary-hover"
                >
                  {content.ctaLabel} <IconArrowRight className="h-4 w-4" />
                </SafeLink>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// SECTION 2 — GIFTS BY OCCASION
export function GiftsByOccasionSection({ section }) {
  const content = section.settings || section.content || {};
  const items = (Array.isArray(content.items) ? content.items : [])
    .filter((item) => item && item.enabled !== false)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  if (!items.length) return null;

  return (
    <section data-testid="gifts-by-occasion" className="mx-auto max-w-7xl px-4 sm:px-8 py-10 sm:py-16">
      <div className="mb-8 sm:mb-12 text-center max-w-2xl mx-auto">
        <span className="text-xs font-semibold uppercase tracking-widest store-primary">Celebrate Milestones</span>
        <h2 className="mt-1 font-serif-display text-2xl sm:text-4xl font-bold store-text">
          {content.heading || "Gifts by Occasion"}
        </h2>
        {content.subtitle && <p className="mt-2 text-xs sm:text-sm store-muted leading-relaxed">{content.subtitle}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
        {items.map((item, idx) => {
          const img = resolveProductImageUrl(item.image);
          return (
            <SafeLink
              key={item.id || idx}
              to={item.destinationUrl || "/shop"}
              data-testid={`occasion-card-${idx}`}
              className="group relative flex flex-col overflow-hidden rounded-2xl border store-border store-surface shadow-xs transition hover:shadow-lg hover:-translate-y-0.5"
            >
              <div className="relative aspect-square w-full overflow-hidden bg-charcoal/5">
                {img ? (
                  <img
                    src={img}
                    alt={item.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center store-muted text-xs uppercase tracking-wider">
                    {item.title}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-transparent to-transparent opacity-80 group-hover:opacity-90 transition" />
                <div className="absolute inset-x-0 bottom-0 p-3 sm:p-5 text-white">
                  <h3 className="font-serif-display text-sm sm:text-lg font-medium leading-snug">{item.title}</h3>
                  <span className="mt-1 inline-flex items-center gap-1 text-[10px] sm:text-xs uppercase tracking-wider text-white/80 group-hover:text-white">
                    Explore <IconArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            </SafeLink>
          );
        })}
      </div>
    </section>
  );
}

// SECTION 3 — CURATED GIFTING STORIES
export function CuratedStoriesSection({ section }) {
  const content = section.settings || section.content || {};
  const stories = (Array.isArray(content.stories) ? content.stories : [])
    .filter((s) => s && s.enabled !== false)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  if (!stories.length) return null;

  return (
    <section data-testid="curated-stories" className="border-t store-border bg-[var(--theme-surface,#faf7f2)]/40 py-12 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="mb-10 sm:mb-14 text-center max-w-2xl mx-auto">
          <span className="text-xs font-semibold uppercase tracking-widest store-primary">Artisan Narratives</span>
          <h2 className="mt-1 font-serif-display text-2xl sm:text-4xl font-bold store-text">
            {content.heading || "Curated Gifting Stories"}
          </h2>
          {content.subtitle && <p className="mt-2 text-xs sm:text-sm store-muted leading-relaxed">{content.subtitle}</p>}
        </div>

        <div className="space-y-12 sm:space-y-16">
          {stories.map((story, idx) => {
            const side = storyImageSide(story.layout, idx);
            const stacked = side === "top";
            const isEven = side === "right"; // text first (left), image second (right)
            const img = resolveProductImageUrl(story.image);
            return (
              <div
                key={story.id || idx}
                data-testid={`story-card-${idx}`}
                data-layout={side}
                className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-12 items-center overflow-hidden rounded-3xl border store-border store-surface p-5 sm:p-10 shadow-xs"
              >
                <div
                  className={`${stacked ? "md:col-span-12 order-2" : "md:col-span-6"} space-y-4 ${
                    stacked ? "" : isEven ? "md:order-1" : "md:order-2"
                  }`}
                >
                  <span className="text-[11px] font-bold uppercase tracking-widest store-secondary">
                    Story 0{idx + 1}
                  </span>
                  <h3 className="font-serif-display text-2xl sm:text-3xl lg:text-4xl font-normal store-text leading-snug">
                    {story.heading}
                  </h3>
                  {story.description && (
                    <p className="text-xs sm:text-sm leading-relaxed store-muted max-w-lg">{story.description}</p>
                  )}
                  {story.ctaLabel && (
                    <div className="pt-2">
                      <SafeLink
                        to={story.destinationUrl || "/shop"}
                        className="inline-flex items-center gap-2 rounded-full store-bg-primary px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-white shadow-xs transition store-primary-hover"
                      >
                        {story.ctaLabel} <IconArrowRight className="h-3.5 w-3.5" />
                      </SafeLink>
                    </div>
                  )}
                </div>

                <div
                  className={`group relative overflow-hidden rounded-2xl ${stacked ? "md:col-span-12 order-1" : "md:col-span-6"} aspect-[4/3] sm:aspect-[16/10] bg-charcoal/5 ${
                    stacked ? "" : isEven ? "md:order-2" : "md:order-1"
                  }`}
                >
                  {img && (
                    <img
                      src={img}
                      alt={story.heading}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// SECTION 4 — GIFTS BY FESTIVAL
export function GiftsByFestivalSection({ section }) {
  const content = section.settings || section.content || {};
  const items = (Array.isArray(content.items) ? content.items : [])
    .filter((item) => item && item.enabled !== false)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  if (!items.length) return null;

  return (
    <section data-testid="gifts-by-festival" className="mx-auto max-w-7xl px-4 sm:px-8 py-10 sm:py-16">
      <div className="mb-8 sm:mb-12 flex flex-wrap items-end justify-between gap-4 border-b store-border pb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest store-primary">Festive Celebrations</span>
          <h2 className="mt-1 font-serif-display text-2xl sm:text-4xl font-bold store-text">
            {content.heading || "Gifts by Festival"}
          </h2>
          {content.subtitle && <p className="mt-1 text-xs sm:text-sm store-muted max-w-xl">{content.subtitle}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-6 sm:grid-cols-4">
        {items.map((item, idx) => {
          const img = resolveProductImageUrl(item.image);
          return (
            <SafeLink
              key={item.id || idx}
              to={item.destinationUrl || "/shop"}
              data-testid={`festival-card-${idx}`}
              className="group relative flex flex-col overflow-hidden rounded-2xl border store-border store-surface shadow-xs transition hover:shadow-md"
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-charcoal/5">
                {img ? (
                  <img
                    src={img}
                    alt={item.label}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center store-muted text-xs uppercase tracking-wider">
                    {item.label}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-charcoal/85 via-charcoal/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                  <h3 className="font-serif-display text-base sm:text-xl font-normal leading-snug">{item.label}</h3>
                  <span className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider store-accent">
                    View Festive Edit <IconArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            </SafeLink>
          );
        })}
      </div>
    </section>
  );
}

// SECTION 5 — GIFTING BENEFITS / SERVICE STRIP
export function GiftingBenefitsSection({ section }) {
  const settings = useSiteSettings();
  const ctx = commercialContext(settings);
  const content = section.settings || section.content || {};
  const cards = (Array.isArray(content.cards) ? content.cards : [])
    .filter((c) => c && c.enabled !== false)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  if (!cards.length) return null;

  const renderIcon = (iconName) => {
    switch (iconName) {
      case "gift":
        return "🎁";
      case "heart":
        return "🤍";
      case "truck":
        return "🚚";
      default:
        return "✨";
    }
  };

  return (
    <section data-testid="gifting-benefits" className="border-y store-border store-surface py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="mb-10 text-center max-w-xl mx-auto">
          <span className="text-xs font-semibold uppercase tracking-widest store-primary">Care in Every Box</span>
          <h2 className="mt-1 font-serif-display text-2xl sm:text-3xl font-bold store-text">
            {content.heading || "The Tushaqsa Gifting Promise"}
          </h2>
          {content.subtitle && <p className="mt-1 text-xs store-muted leading-relaxed">{content.subtitle}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {cards.map((card, idx) => {
            const desc = interpolateCommercial(card.description || "", ctx);
            return (
              <div
                key={card.id || idx}
                data-testid={`benefit-card-${idx}`}
                className="flex flex-col items-center text-center p-6 rounded-2xl border store-border store-bg shadow-xs space-y-3"
              >
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full store-bg-secondary-soft text-xl">
                  {card.image ? (
                    <img src={resolveProductImageUrl(card.image)} alt="" loading="lazy" className="h-full w-full object-cover" data-testid={`benefit-image-${idx}`} />
                  ) : (
                    renderIcon(card.icon)
                  )}
                </div>
                <h3 className="font-serif-display text-lg font-semibold store-text">{card.title}</h3>
                <p className="text-xs store-muted leading-relaxed max-w-xs">{desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// SECTION 6 — GIFTS BY CRAFT / MATERIAL
export function GiftsByCraftSection({ section }) {
  const content = section.settings || section.content || {};
  const crafts = (Array.isArray(content.crafts) ? content.crafts : [])
    .filter((c) => c && c.enabled !== false)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  if (!crafts.length) return null;

  return (
    <section data-testid="gifts-by-craft" className="mx-auto max-w-7xl px-4 sm:px-8 py-10 sm:py-16">
      <div className="mb-8 sm:mb-12 text-center max-w-2xl mx-auto">
        <span className="text-xs font-semibold uppercase tracking-widest store-primary">Artisanal Materials</span>
        <h2 className="mt-1 font-serif-display text-2xl sm:text-4xl font-bold store-text">
          {content.heading || "Shop Gifts by Craft"}
        </h2>
        {content.subtitle && <p className="mt-2 text-xs sm:text-sm store-muted leading-relaxed">{content.subtitle}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-4">
        {crafts.map((craft, idx) => {
          const img = resolveProductImageUrl(craft.image);
          return (
            <SafeLink
              key={craft.id || idx}
              to={craft.destinationUrl || "/shop"}
              data-testid={`craft-card-${idx}`}
              className="group relative flex flex-col overflow-hidden rounded-2xl border store-border store-surface shadow-xs transition hover:shadow-lg"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-charcoal/5">
                {img ? (
                  <img
                    src={img}
                    alt={craft.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center store-muted text-xs uppercase tracking-wider">
                    {craft.title}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                  <h3 className="font-serif-display text-sm sm:text-base font-normal leading-snug">{craft.title}</h3>
                  <span className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/80 group-hover:text-white">
                    Explore Craft <IconArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            </SafeLink>
          );
        })}
      </div>
    </section>
  );
}

// SECTION 7 — FEATURED GIFT PRODUCTS
export function FeaturedGiftsSection({ section, products = [] }) {
  const content = section.settings || section.content || {};
  // The API resolves MANUAL / COLLECTION / QUERY sources server-side and attaches `section.products`.
  // An explicit non-AUTO source that resolves to nothing must stay empty rather than show unrelated products.
  const resolved = Array.isArray(section.products) ? section.products : null;
  const explicitSource = ["MANUAL", "COLLECTION", "QUERY"].includes(content.sourceMode);
  const list = resolved && (resolved.length > 0 || explicitSource) ? resolved : products;

  if (!list || list.length === 0) return null;

  const displayList = list.slice(0, content.limit || 4);

  return (
    <section data-testid="featured-gifts" className="mx-auto max-w-7xl px-4 sm:px-8 py-10 sm:py-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b store-border pb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest store-primary">
            {content.eyebrow || "Artisan Selection"}
          </span>
          <h2 className="mt-1 font-serif-display text-3xl font-bold store-text sm:text-4xl">
            {content.heading || "Handpicked Gifts"}
          </h2>
          {content.subtitle && <p className="mt-1 max-w-xl text-xs sm:text-sm store-muted">{content.subtitle}</p>}
        </div>
        {content.ctaLabel && (
          <SafeLink
            to={content.ctaUrl || "/shop"}
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider store-primary hover:underline"
          >
            {content.ctaLabel} <IconArrowRight className="h-4 w-4" />
          </SafeLink>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        {displayList.map((product) => (
          <ProductCard key={product.id || product.slug} product={product} />
        ))}
      </div>
    </section>
  );
}

// SECTION 8 — GIFTS BY BUDGET
export function GiftsByBudgetSection({ section }) {
  const content = section.settings || section.content || {};
  const tiers = (Array.isArray(content.tiers) ? content.tiers : [])
    .filter((t) => t && t.enabled !== false)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  if (!tiers.length) return null;

  return (
    <section data-testid="gifts-by-budget" className="mx-auto max-w-7xl px-4 sm:px-8 py-10 sm:py-16">
      <div className="mb-8 sm:mb-12 text-center max-w-2xl mx-auto">
        <span className="text-xs font-semibold uppercase tracking-widest store-primary">Considered Values</span>
        <h2 className="mt-1 font-serif-display text-2xl sm:text-4xl font-bold store-text">
          {content.heading || "Gifts by Budget"}
        </h2>
        {content.subtitle && <p className="mt-2 text-xs sm:text-sm store-muted leading-relaxed">{content.subtitle}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {tiers.map((tier, idx) => (
          <SafeLink
            key={tier.id || idx}
            to={budgetTierUrl(tier)}
            data-testid={`budget-card-${idx}`}
            className="group flex flex-col justify-between p-6 sm:p-8 rounded-2xl border store-border store-surface shadow-xs transition hover:shadow-lg hover:border-[var(--theme-primary)]"
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest store-secondary">Tier 0{idx + 1}</span>
              <h3 className="mt-2 font-serif-display text-xl sm:text-2xl font-semibold store-text group-hover:store-primary transition">
                {tier.label}
              </h3>
              {tier.description && <p className="mt-2 text-xs store-muted leading-relaxed">{tier.description}</p>}
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider store-primary">
              <span>Explore Collection</span> <IconArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
            </div>
          </SafeLink>
        ))}
      </div>
    </section>
  );
}

// SECTION 9 — GIFTING CONTENT / SEO SECTION
export function GiftingSeoSection({ section }) {
  const content = section.settings || section.content || {};
  if (!content.heading && !content.content) return null;

  return (
    <section data-testid="gifting-seo" className="border-t store-border bg-[var(--theme-surface,#faf7f2)]/25 py-12 sm:py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-8">
        <div className="store-surface p-8 sm:p-12 rounded-3xl border store-border shadow-xs space-y-4">
          {content.heading && (
            <h2 className="font-serif-display text-2xl sm:text-3xl font-bold store-text leading-snug">
              {content.heading}
            </h2>
          )}
          {content.content && <RichTextRenderer content={content.content} />}
        </div>
      </div>
    </section>
  );
}

// SECTION 10 — GIFTING FAQ
export function GiftingFaqSection({ section }) {
  const settings = useSiteSettings();
  const ctx = commercialContext(settings);
  const content = section.settings || section.content || {};
  const items = (Array.isArray(content.items) ? content.items : [])
    .filter((it) => it && it.enabled !== false)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const [openMap, setOpenMap] = useState({ 0: true });

  if (!items.length) return null;

  const toggle = (idx) => {
    setOpenMap((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <section data-testid="gifting-faq" className="mx-auto max-w-4xl px-4 sm:px-8 py-12 sm:py-20">
      <div className="mb-10 text-center max-w-xl mx-auto">
        <span className="text-xs font-semibold uppercase tracking-widest store-primary">Help & Assurance</span>
        <h2 className="mt-1 font-serif-display text-2xl sm:text-4xl font-bold store-text">
          {content.heading || "Frequently Asked Questions About Gifting"}
        </h2>
        {content.subtitle && <p className="mt-2 text-xs sm:text-sm store-muted leading-relaxed">{content.subtitle}</p>}
      </div>

      <div className="divide-y store-border border-y store-border">
        {items.map((item, idx) => {
          const isOpen = !!openMap[idx];
          const answer = interpolateCommercial(item.answer || "", ctx);
          return (
            <div key={item.id || idx} className="py-4 sm:py-5" data-testid={`faq-item-${idx}`}>
              <button
                type="button"
                onClick={() => toggle(idx)}
                className="flex w-full items-center justify-between text-left font-serif-display text-base sm:text-lg font-medium store-text hover:store-primary transition"
                aria-expanded={isOpen}
              >
                <span>{item.question}</span>
                <span className="ml-4 text-sm store-muted font-mono">{isOpen ? "—" : "+"}</span>
              </button>
              {isOpen && (
                <div className="mt-3 text-xs sm:text-sm store-muted leading-relaxed animate-fade-in pr-6">
                  {answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
