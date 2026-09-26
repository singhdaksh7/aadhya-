import React from "react";
import { Link } from "react-router-dom";
import CircularCategoryNav from "./CircularCategoryNav";
import PromoStrip from "./PromoStrip";
import HeroBannerCarousel from "./HeroBannerCarousel";
import TrustServiceStrip from "./TrustServiceStrip";
import PromoBanners2Up from "./PromoBanners2Up";
import ProductCard from "./ProductCard";
import { ProductGridSkeleton } from "./ui/Skeleton";
import { formatInr } from "../lib/format";
import { IconArrowRight } from "./icons";

export default function HomepageRenderer({
  sections = [],
  categories = [],
  newArrivals = [],
  bestSellers = [],
  featuredCollection = null,
  booksList = [],
  isLoading = false,
  subscribed = false,
  newsletterEmail = "",
  setNewsletterEmail = () => {},
  handleNewsletterSubmit = () => {},
  newsletterStatus = "idle",
  newsletterError = "",
}) {
  if (!sections || sections.length === 0) return null;

  // Split section flow between top header stack and spaced body content
  const topTypes = new Set(["CIRCULAR_CATEGORY_NAV", "CATEGORY_CIRCLES", "PROMO_STRIP", "PROMO_TICKER", "HERO_CAROUSEL", "HERO", "TRUST_STRIP", "TRUST_BADGES"]);
  const topSections = sections.filter((s) => topTypes.has(s.type));
  const bodySections = sections.filter((s) => !topTypes.has(s.type));

  const renderSectionItem = (section) => {
    switch (section.type) {
      case "CIRCULAR_CATEGORY_NAV":
      case "CATEGORY_CIRCLES":
        return <CircularCategoryNav key={section.id || section.type} categories={categories} />;

      case "PROMO_STRIP":
      case "PROMO_TICKER":
        return <PromoStrip key={section.id || section.type} />;

      case "HERO_CAROUSEL":
      case "HERO":
        return <HeroBannerCarousel key={section.id || section.type} />;

      case "TRUST_STRIP":
      case "TRUST_BADGES":
        return <TrustServiceStrip key={section.id || section.type} />;

      case "NEW_ARRIVALS":
        return (
          <section key={section.id || section.type} className="mx-auto max-w-7xl px-4 sm:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-8 border-b border-charcoal/10 pb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">
                  {section.settings?.eyebrow || "Fresh Drops"}
                </span>
                <h2 className="mt-1 font-serif-display text-3xl sm:text-4xl text-charcoal font-bold">
                  {section.settings?.title || section.name || "New Arrivals"}
                </h2>
              </div>
              <Link to="/new-arrivals" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-terracotta hover:underline">
                View All New Arrivals <IconArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {isLoading ? (
              <ProductGridSkeleton count={4} />
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
                {newArrivals.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </section>
        );

      case "PROMO_BANNERS_2UP":
      case "MULTI_BANNER":
        return <PromoBanners2Up key={section.id || section.type} />;

      case "BEST_SELLERS":
        return (
          <section key={section.id || section.type} className="mx-auto max-w-7xl px-4 sm:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-8 border-b border-charcoal/10 pb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">
                  {section.settings?.eyebrow || "Most Cherished"}
                </span>
                <h2 className="mt-1 font-serif-display text-3xl sm:text-4xl text-charcoal font-bold">
                  {section.settings?.title || section.name || "Best Sellers"}
                </h2>
              </div>
              <Link to="/best-sellers" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-terracotta hover:underline">
                View All Best Sellers <IconArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {isLoading ? (
              <ProductGridSkeleton count={4} />
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
                {bestSellers.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </section>
        );

      case "FEATURED_COLLECTION":
      case "COLLECTION":
        return featuredCollection ? (
          <section key={section.id || section.type} className="mx-auto max-w-7xl px-4 sm:px-8">
            <div className="overflow-hidden rounded-2xl border border-charcoal/10 bg-[#FAF6F0] grid lg:grid-cols-12 items-center">
              <div className="p-8 sm:p-14 lg:col-span-6 space-y-5">
                <span className="text-xs font-semibold uppercase tracking-widest text-sage font-bold">
                  Featured Editorial Collection
                </span>
                <h2 className="font-serif-display text-3xl sm:text-4xl lg:text-5xl text-charcoal font-bold">
                  {featuredCollection.name}
                </h2>
                <p className="text-sm sm:text-base text-charcoal-soft leading-relaxed">
                  {featuredCollection.description}
                </p>
                <div className="pt-2">
                  <Link
                    to={`/collections/${featuredCollection.slug}`}
                    className="inline-flex items-center gap-2 rounded-full bg-terracotta px-7 py-3 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-terracotta-dark shadow-xs"
                  >
                    Explore Collection <IconArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
              <div className="lg:col-span-6 aspect-square sm:aspect-video lg:aspect-auto h-full min-h-[340px] overflow-hidden group">
                <img
                  src={featuredCollection.heroImage}
                  alt={featuredCollection.name}
                  className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
              </div>
            </div>
          </section>
        ) : null;

      case "SHOP_THE_LOOK":
        return (
          <section key={section.id || section.type} className="mx-auto max-w-7xl px-4 sm:px-8">
            <div className="flex flex-col items-center text-center mb-10">
              <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">
                Lifestyle Inspiration
              </span>
              <h2 className="mt-1.5 font-serif-display text-3xl sm:text-4xl text-charcoal font-bold">
                Shop the Look
              </h2>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  title: "Living Room Edit",
                  tagline: "Brass Sconces & Woven Throws",
                  image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?q=80&w=800&auto=format&fit=crop",
                  slug: "home-decor"
                },
                {
                  title: "Mindful Corner",
                  tagline: "Soapstone Urns & Sandalwood",
                  image: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?q=80&w=800&auto=format&fit=crop",
                  slug: "wellness-decor"
                },
                {
                  title: "Warm Neutrals",
                  tagline: "Terracotta Clay & Linen Runners",
                  image: "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?q=80&w=800&auto=format&fit=crop",
                  slug: "earth-collection"
                },
                {
                  title: "Books & Objects",
                  tagline: "Heritage Monographs & Wood Pedestals",
                  image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=800&auto=format&fit=crop",
                  slug: "books"
                }
              ].map((look) => (
                <Link
                  key={look.title}
                  to={`/collections/${look.slug}`}
                  className="group relative overflow-hidden rounded-2xl border border-charcoal/10 bg-white transition hover:shadow-xl"
                >
                  <div className="aspect-[3/4] w-full overflow-hidden">
                    <img
                      src={look.image}
                      alt={look.title}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-charcoal/85 via-charcoal/30 to-transparent p-6 flex flex-col justify-end text-white">
                    <h3 className="font-serif-display text-xl font-bold">{look.title}</h3>
                    <p className="mt-1 text-xs text-white/80">{look.tagline}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-terracotta-light group-hover:underline">
                      View Edit <IconArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );

      case "BOOKS_SHELF":
      case "BOOKS":
        return (
          <section key={section.id || section.type} className="bg-[#FAF6F0] py-16 border-y border-charcoal/10">
            <div className="mx-auto max-w-7xl px-4 sm:px-8">
              <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">Editorial Monographs</span>
                  <h2 className="mt-1 font-serif-display text-3xl sm:text-4xl text-charcoal font-bold">From Our Bookshelf</h2>
                </div>
                <Link to="/books" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-terracotta hover:underline">
                  Explore Books <IconArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="grid gap-6 sm:grid-cols-3">
                {booksList.map((book) => (
                  <div key={book.id} className="flex flex-col rounded-xl border border-charcoal/10 bg-white p-5 shadow-xs hover:shadow-md transition">
                    <div className="aspect-[3/4] w-full overflow-hidden rounded-lg bg-[#FAF6F0] mb-4">
                      <img src={book.images[0]} alt={book.name} className="h-full w-full object-cover" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-terracotta">Hardcover Edition</span>
                    <h3 className="font-serif-display text-base font-bold text-charcoal mt-1 line-clamp-1">{book.name}</h3>
                    <p className="text-xs text-charcoal-soft italic mt-0.5">By {book.author}</p>
                    <p className="mt-2 text-xs text-charcoal-soft line-clamp-2 leading-relaxed">{book.shortDescription}</p>
                    <div className="mt-auto pt-4 flex items-center justify-between border-t border-charcoal/10">
                      <span className="text-sm font-semibold text-terracotta">{formatInr(book.price)}</span>
                      <Link
                        to={`/products/${book.slug}`}
                        className="rounded-full bg-[#FAF6F0] px-3.5 py-1.5 text-xs font-medium text-charcoal hover:bg-terracotta hover:text-white transition"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );

      case "EDITORIAL_BRAND":
      case "IMAGE_TEXT":
        return (
          <section key={section.id || section.type} className="mx-auto max-w-7xl px-4 sm:px-8 py-8">
            <div className="grid items-center gap-12 lg:grid-cols-12 rounded-2xl border border-charcoal/10 p-8 sm:p-12 bg-white">
              <div className="lg:col-span-6 space-y-6">
                <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">
                  Craftsmanship &amp; Mindful Living
                </span>
                <h2 className="font-serif-display text-3xl sm:text-4xl lg:text-5xl text-charcoal font-bold">
                  Honoring Earth, Metal &amp; Human Hands
                </h2>
                <p className="text-sm sm:text-base leading-relaxed text-charcoal-soft">
                  Every piece in the Aadya collection originates in quiet Indian artisan workshops. From lost-wax Dhokra bronze figurines in Odisha to Jaipur blue pottery and hand-chased brassware, our objects carry stories of patience, sustainable raw materials, and sacred proportions.
                </p>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="border-l-2 border-terracotta pl-4">
                    <p className="font-serif-display text-2xl text-charcoal font-bold">100% Organic</p>
                    <p className="text-xs text-charcoal-soft mt-1">Natural clays, unbleached flax, solid brass and mineral oxides.</p>
                  </div>
                  <div className="border-l-2 border-sage pl-4">
                    <p className="font-serif-display text-2xl text-charcoal font-bold">Artisan Direct</p>
                    <p className="text-xs text-charcoal-soft mt-1">Supporting rural weaver and metalsmith craft clusters.</p>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6 relative">
                <div className="overflow-hidden rounded-2xl shadow-lg aspect-[4/3]">
                  <img
                    src="https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=1200&auto=format&fit=crop"
                    alt="Aadya Editorial Interior"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            </div>
          </section>
        );

      case "NEWSLETTER":
        return (
          <section key={section.id || section.type} className="mx-auto max-w-4xl px-4 sm:px-8 text-center pt-4">
            <div className="rounded-2xl border border-charcoal/10 bg-[#FAF6F0] p-8 sm:p-12 space-y-4">
              <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">Join Our Circle</span>
              <h2 className="font-serif-display text-3xl sm:text-4xl text-charcoal font-bold">Stories of Craft &amp; New Arrivals</h2>
              <p className="max-w-md mx-auto text-xs sm:text-sm text-charcoal-soft leading-relaxed">
                Subscribe to receive quiet reflections, artisan spotlights, and early access to limited edition seasonal drops.
              </p>

              {subscribed ? (
                <div className="rounded-xl bg-sage-light p-4 text-xs sm:text-sm font-medium text-green-deep">
                  Thank you for subscribing to Aadya! We look forward to sharing our journey with you.
                </div>
              ) : (
                <form onSubmit={handleNewsletterSubmit} className="mt-6 flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                  <input
                    type="email"
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    placeholder="Enter your email address"
                    required
                    className="flex-1 rounded-full border border-charcoal/20 bg-white px-5 py-3 text-xs sm:text-sm text-charcoal focus:outline-none focus:border-terracotta"
                  />
                  <button
                    type="submit"
                    disabled={newsletterStatus === "loading"}
                    className="rounded-full bg-terracotta px-7 py-3 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-terracotta-dark shrink-0 disabled:opacity-60 shadow-xs"
                  >
                    {newsletterStatus === "loading" ? "Subscribing…" : "Subscribe"}
                  </button>
                </form>
              )}
              {newsletterStatus === "error" && (
                <p className="text-xs font-medium text-terracotta">{newsletterError}</p>
              )}
            </div>
          </section>
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full">
      {topSections.length > 0 && (
        <div className="w-full">
          {topSections.map((sec) => renderSectionItem(sec))}
        </div>
      )}

      {bodySections.length > 0 && (
        <div className="mt-12 sm:mt-16 space-y-12 sm:space-y-16">
          {bodySections.map((sec) => renderSectionItem(sec))}
        </div>
      )}
    </div>
  );
}
