import React from "react";
import { Link } from "react-router-dom";
import PromoStrip from "./PromoStrip";
import HeroBannerCarousel from "./HeroBannerCarousel";
import TrustServiceStrip from "./TrustServiceStrip";
import PromoBanners2Up from "./PromoBanners2Up";
import ProductCard from "./ProductCard";
import { ProductGridSkeleton } from "./ui/Skeleton";
import { formatInr } from "../lib/format";
import { IconArrowRight } from "./icons";
import EditorialProductSection from "./EditorialProductSection";
import ReviewsSection from "./ReviewsSection";
import BlogPreviewSection from "./BlogPreviewSection";
import ProductScroller from "./ProductScroller";
import HomepageSectionTitle, { SectionCta } from "./HomepageSectionTitle";
import { spacingClass } from "../lib/homepageConfig";

const route = (value, fallback = "/shop") => typeof value === "string" && (value.startsWith("/") || /^https?:\/\//i.test(value)) ? value : fallback;
function SafeLink({ to, children, ...props }) { const url = route(to); return url.startsWith("/") ? <Link to={url} {...props}>{children}</Link> : <a href={url} {...props}>{children}</a>; }
const enabled = (items = []) => items.filter((item) => item.enabled !== false).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

export default function HomepageRenderer({ sections = [], newArrivals = [], bestSellers = [], featuredCollection = null, booksList = [], isLoading = false, subscribed = false, newsletterEmail = "", setNewsletterEmail = () => {}, handleNewsletterSubmit = () => {}, newsletterStatus = "idle", newsletterError = "" }) {
  if (!sections?.length) return null;
  const renderProducts = (products, limit, arrows = false) => {
    if (isLoading) return <ProductGridSkeleton count={limit || 4} />;
    const cards = products.slice(0, limit || 4).map((product) => <ProductCard key={product.id} product={product} />);
    return arrows ? <ProductScroller>{cards}</ProductScroller> : <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">{cards}</div>;
  };
  const renderSection = (section) => {
    const s = section.settings || {};
    switch (section.type) {
      // HOTFIX: circular category strip is never rendered on the customer storefront.
      case "CIRCULAR_CATEGORY_NAV": case "CATEGORY_CIRCLES": return null;
      case "PROMO_STRIP": case "PROMO_TICKER": {
        if (typeof window !== "undefined" && window.__AADYA_HEADER_RENDERED__) return null;
        return <PromoStrip key={section.id} promoConfig={s} />;
      }
      case "HERO_CAROUSEL": case "HERO": return <HeroBannerCarousel key={section.id} />;
      case "TRUST_STRIP": case "TRUST_BADGES": return <TrustServiceStrip key={section.id} items={s.items} config={s} />;
      case "PROMO_BANNERS_2UP": case "MULTI_BANNER": return <PromoBanners2Up key={section.id} promoCards={s.items} layout={s.layout} showSubtitle={s.showSubtitle === true} />;
      case "NEW_ARRIVALS": case "BEST_SELLERS": {
        const isNew = section.type === "NEW_ARRIVALS"; const defaults = isNew ? ["Fresh Drops", "New This Week", "View All New Arrivals", "/new-arrivals", "New pieces selected for the season"] : ["Most Cherished", "Best Sellers", "View All Best Sellers", "/best-sellers", "Loved most by our community"];
        // Prefer products resolved server-side on the section itself (batch-fetched by
        // the homepage API); fall back to the legacy prop path for callers/tests that
        // still supply newArrivals/bestSellers directly.
        const products = Array.isArray(section.products) ? section.products : (isNew ? newArrivals : bestSellers);
        if (!isLoading && products.length === 0) return null; // never render heading + empty grid
        const centered = s.headingAlign !== "LEFT"; // rails default to a centered editorial heading
        const ctaTo = s.ctaUrl || defaults[3]; const ctaLabel = s.ctaLabel || defaults[2];
        if (centered) return <section key={section.id} className="mx-auto max-w-7xl px-4 sm:px-8"><HomepageSectionTitle align="CENTER" eyebrow={s.eyebrow || defaults[0]} title={s.title || defaults[1]} subtitle={s.subtitle ?? defaults[4]} className="mb-10 sm:mb-12" />{renderProducts(products, s.limit, s.showArrows === true)}{s.showCta !== false && <SectionCta to={ctaTo}>{ctaLabel}</SectionCta>}</section>;
        return <section key={section.id} className="mx-auto max-w-7xl px-4 sm:px-8"><div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b store-border pb-4"><div><span className="text-xs font-semibold uppercase tracking-widest store-primary">{s.eyebrow || defaults[0]}</span><h2 className="mt-1 font-serif-display text-3xl font-bold store-text sm:text-4xl">{s.title || defaults[1]}</h2>{s.subtitle && <p className="mt-2 max-w-xl text-sm store-muted">{s.subtitle}</p>}</div>{s.showCta !== false && <SafeLink to={s.ctaUrl || defaults[3]} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider store-primary hover:underline">{s.ctaLabel || defaults[2]} <IconArrowRight className="h-4 w-4" /></SafeLink>}</div>{renderProducts(products, s.limit, s.showArrows === true)}</section>;
      }
      case "FEATURED_COLLECTION": case "COLLECTION": {
        // Prefer the collection resolved server-side on the section itself; fall back
        // to the legacy prop path for callers/tests that still supply it directly.
        const collection = section.collection !== undefined ? section.collection : featuredCollection;
        if (!isLoading && !collection) return null; // no configured/active collection: hide, never a broken card
        if (!collection) return null;
        const target = s.ctaUrl || (s.collectionSlug ? `/collections/${s.collectionSlug}` : `/collections/${collection.slug}`);
        return <section key={section.id} className="mx-auto max-w-7xl px-4 sm:px-8"><div className={`grid items-center overflow-hidden rounded-2xl border store-border lg:grid-cols-12 ${s.backgroundStyle === "WHITE" ? "store-bg" : "store-surface"}`}><div className="space-y-5 p-8 sm:p-14 lg:col-span-6"><span className="text-xs font-bold uppercase tracking-widest store-secondary">{s.eyebrow || "Featured Editorial Collection"}</span><h2 className="font-serif-display text-3xl font-bold store-text sm:text-4xl lg:text-5xl">{s.title || collection.name || collection.title}</h2>{s.description !== "" && <p className="text-sm leading-relaxed store-muted sm:text-base">{s.description || collection.description}</p>}<SafeLink to={target} className="inline-flex items-center gap-2 rounded-full store-bg-primary px-7 py-3 text-xs font-semibold uppercase tracking-wider text-white shadow-xs transition store-primary-hover">{s.ctaLabel || "Explore Collection"} <IconArrowRight className="h-4 w-4" /></SafeLink></div><div className="group min-h-[340px] overflow-hidden aspect-square sm:aspect-video lg:col-span-6 lg:aspect-auto"><img src={s.image || collection.heroImage} alt={s.imageAlt || s.title || collection.name || collection.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" /></div></div></section>;
      }
      case "SHOP_THE_LOOK": {
        const looks = enabled(s.items || []);
        if (looks.length === 0) return null;
        return <section key={section.id} className="mx-auto max-w-7xl px-4 sm:px-8"><HomepageSectionTitle align={s.headingAlign === "LEFT" ? "LEFT" : "CENTER"} eyebrow={s.eyebrow || "Lifestyle Inspiration"} title={s.title || "Shop the Look"} subtitle={s.subtitle ?? "Rooms styled with our favourite pieces"} className="mb-10 sm:mb-12" /><div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">{looks.map((look) => <SafeLink key={look.id || look.title} to={look.url} className="group relative overflow-hidden rounded-2xl border store-border store-surface transition hover:shadow-xl"><div className="aspect-[3/4] overflow-hidden"><img src={look.image} alt={look.imageAlt || look.title} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" /></div><div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-charcoal/85 via-charcoal/30 to-transparent p-4 text-white sm:p-6"><h3 className="font-serif-display text-base font-normal sm:text-xl">{look.title}</h3><p className="mt-1 text-[11px] text-white/80 sm:text-xs">{look.tagline}</p><span className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] store-accent sm:text-xs">{s.ctaLabel || "View Edit"} <IconArrowRight className="h-3.5 w-3.5" /></span></div></SafeLink>)}</div></section>;
      }
      case "BOOKS_SHELF": case "BOOKS": {
        // Prefer books resolved server-side on the section itself; fall back to the
        // legacy prop path for callers/tests that still supply booksList directly.
        const books = Array.isArray(section.books) ? section.books : booksList;
        if (!isLoading && books.length === 0) return null;
        return <section key={section.id} className="border-y store-border store-surface py-16"><div className="mx-auto max-w-7xl px-4 sm:px-8"><div className="mb-10 flex flex-wrap items-end justify-between gap-4"><div><span className="text-xs font-semibold uppercase tracking-widest store-primary">{s.eyebrow || "Editorial Monographs"}</span><h2 className="mt-1 font-serif-display text-2xl font-normal store-text sm:text-3xl lg:text-[2.5rem]">{s.title || "From Our Bookshelf"}</h2></div><SafeLink to={s.ctaUrl || "/books"} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider store-primary hover:underline">{s.ctaLabel || "Explore Books"} <IconArrowRight className="h-4 w-4" /></SafeLink></div><div className="grid gap-6 sm:grid-cols-3">{books.slice(0, s.limit || 3).map((book) => <div key={book.id} className="flex flex-col rounded-xl border store-border store-surface p-5 shadow-xs"><div className="mb-4 aspect-[3/4] overflow-hidden rounded-lg store-surface"><img src={book.images?.[0]} alt={book.name} className="h-full w-full object-cover" /></div><h3 className="font-serif-display text-base font-bold store-text">{book.name}</h3>{s.showAuthor !== false && <p className="mt-0.5 text-xs italic store-muted">By {book.author}</p>}{s.showDescription !== false && <p className="mt-2 text-xs leading-relaxed store-muted">{book.shortDescription}</p>}{s.showPrice !== false && <span className="mt-3 text-sm font-semibold store-primary">{formatInr(book.price)}</span>}</div>)}</div></div></section>;
      }
      case "EDITORIAL_BRAND": case "IMAGE_TEXT": return <EditorialProductSection key={section.id} section={section} />;
      case "NEWSLETTER": return <section key={section.id} className="mx-auto max-w-4xl px-4 pt-4 text-center sm:px-8"><div className="space-y-4 rounded-2xl border store-border store-surface p-8 sm:p-12"><span className="text-xs font-semibold uppercase tracking-widest store-primary">{s.eyebrow || "Join Our Circle"}</span><h2 className="font-serif-display text-3xl font-bold store-text sm:text-4xl">{s.title || "Stories of Craft & New Arrivals"}</h2><p className="mx-auto max-w-md text-xs leading-relaxed store-muted sm:text-sm">{s.description}</p>{subscribed ? <div className="rounded-xl store-bg-secondary-soft p-4 text-xs font-medium store-secondary sm:text-sm">{s.successMessage || "Thank you for subscribing to Aadya!"}</div> : <form onSubmit={handleNewsletterSubmit} className="mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row"><input type="email" value={newsletterEmail} onChange={(e) => setNewsletterEmail(e.target.value)} placeholder={s.placeholder || "Enter your email address"} required className="flex-1 rounded-full border store-border store-bg px-5 py-3 text-xs store-text" /><button type="submit" disabled={newsletterStatus === "loading"} className="rounded-full store-bg-primary px-7 py-3 text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-60">{newsletterStatus === "loading" ? (s.loadingLabel || "Subscribing…") : (s.buttonLabel || "Subscribe")}</button></form>}{newsletterStatus === "error" && <p className="text-xs font-medium store-primary">{s.errorPrefix ? `${s.errorPrefix} ${newsletterError}` : newsletterError}</p>}</div></section>;
      case "TESTIMONIALS": return <ReviewsSection key={section.id} section={section} />;
      case "BLOG_PREVIEW": return <BlogPreviewSection key={section.id} section={section} />;
      default: return null;
    }
  };
  // Per-section spacing (COMPACT / NORMAL / SPACIOUS). NORMAL adds no wrapper.
  const spaced = (section) => {
    const node = renderSection(section);
    const cls = spacingClass(section.settings?.spacing);
    return node && cls ? <div key={section.id} data-spacing={section.settings.spacing} className={cls}>{node}</div> : node;
  };
  const topTypes = new Set(["CIRCULAR_CATEGORY_NAV", "CATEGORY_CIRCLES", "PROMO_STRIP", "PROMO_TICKER", "HERO_CAROUSEL", "HERO", "TRUST_STRIP", "TRUST_BADGES"]);
  const top = sections.filter((s) => topTypes.has(s.type)); const body = sections.filter((s) => !topTypes.has(s.type));
  return <div className="w-full">{top.map(spaced)}<div className="mt-12 space-y-12 sm:mt-16 sm:space-y-16">{body.map(spaced)}</div></div>;
}
