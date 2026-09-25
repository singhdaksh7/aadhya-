import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { getProducts, getCategories, getCollections } from "../services/api";
import { subscribeNewsletter, ApiRequestError } from "../lib/api";
import { ProductGridSkeleton } from "../components/ui/Skeleton";
import { formatInr } from "../lib/format";
import { IconArrowRight, IconCheck } from "../components/icons";

export default function Home() {
  const [categories, setCategories] = useState([]);
  const [newArrivals, setNewArrivals] = useState([]);
  const [bestSellers, setBestSellers] = useState([]);
  const [featuredCollection, setFeaturedCollection] = useState(null);
  const [booksList, setBooksList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [newsletterStatus, setNewsletterStatus] = useState("idle"); // idle | loading | error
  const [newsletterError, setNewsletterError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadHomeData() {
      setIsLoading(true);
      const [catsRes, colsRes, newRes, bestRes, booksRes] = await Promise.all([
        getCategories(),
        getCollections(),
        getProducts({ isNew: true }),
        getProducts({ isBestSeller: true }),
        getProducts({ categorySlug: "books" })
      ]);

      if (!active) return;
      setCategories(catsRes.data || []);
      if (colsRes.data?.length > 0) setFeaturedCollection(colsRes.data[0]);
      setNewArrivals((newRes.data || []).slice(0, 4));
      setBestSellers((bestRes.data || []).slice(0, 4));
      setBooksList((booksRes.data || []).slice(0, 3));
      setIsLoading(false);
    }
    loadHomeData();
    return () => { active = false; };
  }, []);

  const handleNewsletterSubmit = async (e) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setNewsletterStatus("loading");
    setNewsletterError("");
    try {
      await subscribeNewsletter(newsletterEmail.trim());
      setSubscribed(true);
      setNewsletterStatus("idle");
    } catch (err) {
      setNewsletterStatus("error");
      setNewsletterError(
        err instanceof ApiRequestError && err.status === 400
          ? "Please enter a valid email address."
          : err.message || "Could not subscribe right now. Please try again."
      );
    }
  };

  return (
    <div className="space-y-20 pb-16">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden bg-ivory-dark/60 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid items-center gap-10 sm:gap-12 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-6 animate-fade-up">
              <span className="inline-block rounded-full bg-beige-light px-3.5 py-1 text-xs font-semibold uppercase tracking-widest text-terracotta">
                Aadya Home &amp; Lifestyle
              </span>
              <h1 className="font-serif-display text-4xl leading-[1.1] text-charcoal sm:text-5xl lg:text-6xl">
                Objects for Thoughtful Living
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-charcoal-soft sm:text-lg">
                Discover handcrafted oil lamps, unglazed clay vessels, linen textiles, and slow design books crafted to bring warmth and quiet grace to your sanctuary.
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-2 pb-4 sm:pb-0">
                <Link
                  to="/shop"
                  className="rounded-full bg-terracotta px-8 py-3.5 text-xs font-semibold uppercase tracking-wider text-ivory transition hover:bg-terracotta/90 shadow-md"
                >
                  Shop Home Decor
                </Link>
                <Link
                  to="/collections"
                  className="rounded-full border border-charcoal/20 bg-white/80 px-8 py-3.5 text-xs font-semibold uppercase tracking-wider text-charcoal transition hover:border-terracotta hover:text-terracotta"
                >
                  Explore Collections
                </Link>
              </div>
            </div>

            {/* Editorial Hero Visual Grid */}
            <div className="lg:col-span-6 animate-fade-up pt-4 sm:pt-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="overflow-hidden rounded-3xl shadow-lg aspect-[3/4]">
                  <img
                    src="https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=1000&auto=format&fit=crop"
                    alt="Aadya Handcrafted Brassware"
                    className="h-full w-full object-cover transition duration-700 hover:scale-105"
                  />
                </div>
                <div className="space-y-4 pt-8">
                  <div className="overflow-hidden rounded-3xl shadow-md aspect-square">
                    <img
                      src="https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?q=80&w=1000&auto=format&fit=crop"
                      alt="Terracotta Earth Vessel"
                      className="h-full w-full object-cover transition duration-700 hover:scale-105"
                    />
                  </div>
                  <div className="rounded-2xl border border-charcoal/10 bg-ivory p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-wider text-terracotta font-semibold">Artisan Heritage</p>
                    <p className="mt-1 font-serif-display text-base text-charcoal">"Form follows quiet ritual."</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. SHOP BY CATEGORY */}
      <section className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-col items-center text-center mb-10">
          <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">Curated Spaces</span>
          <h2 className="mt-2 font-serif-display text-3xl text-charcoal sm:text-4xl">Shop by Category</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-5">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/collections/${cat.slug}`}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-charcoal/10 bg-white transition hover:border-terracotta/40 hover:shadow-lg"
            >
              <div className="aspect-[4/5] w-full overflow-hidden bg-ivory-dark/40">
                <img
                  src={cat.image}
                  alt={cat.name}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-3.5 sm:p-4 text-center flex flex-col justify-center flex-1">
                <h3 className="font-serif-display text-sm sm:text-base leading-snug text-charcoal transition group-hover:text-terracotta line-clamp-2">
                  {cat.name}
                </h3>
                <p className="mt-1 text-xs text-charcoal-soft">{cat.itemCount} items</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 3. FEATURED COLLECTION */}
      {featuredCollection && (
        <section className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="overflow-hidden rounded-3xl border border-charcoal/10 bg-sage-light/30 grid lg:grid-cols-12 items-center">
            <div className="p-8 sm:p-14 lg:col-span-6 space-y-5">
              <span className="text-xs font-semibold uppercase tracking-widest text-green-deep">
                Featured Editorial Collection
              </span>
              <h2 className="font-serif-display text-3xl text-charcoal sm:text-4xl lg:text-5xl">
                {featuredCollection.name}
              </h2>
              <p className="text-base text-charcoal-soft leading-relaxed">
                {featuredCollection.description}
              </p>
              <div className="pt-2">
                <Link
                  to={`/collections/${featuredCollection.slug}`}
                  className="inline-flex items-center gap-2 rounded-full bg-green-deep px-8 py-3.5 text-xs font-semibold uppercase tracking-wider text-ivory transition hover:bg-green"
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
      )}

      {/* 4. NEW ARRIVALS */}
      <section className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">Just Arrived</span>
            <h2 className="mt-1 font-serif-display text-3xl text-charcoal sm:text-4xl">New Arrivals</h2>
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

      {/* 5. HOME EDITORIAL SECTION */}
      <section className="bg-ivory-dark/80 py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-12">
            <div className="lg:col-span-6 space-y-6">
              <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">
                Craftsmanship &amp; Mindful Living
              </span>
              <h2 className="font-serif-display text-3xl text-charcoal sm:text-4xl lg:text-5xl">
                Honoring Earth, Metal &amp; Human Hands
              </h2>
              <p className="text-base leading-relaxed text-charcoal-soft">
                Every piece in the Aadya collection originates in quiet Indian artisan workshops. From lost-wax Dhokra bronze figurines in Odisha to Jaipur blue pottery and hand-chased brassware, our objects carry stories of patience, sustainable raw materials, and sacred proportions.
              </p>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="border-l-2 border-terracotta pl-4">
                  <p className="font-serif-display text-2xl text-charcoal">100% Organic</p>
                  <p className="text-xs text-charcoal-soft mt-1">Natural clays, unbleached flax, solid brass and mineral oxides.</p>
                </div>
                <div className="border-l-2 border-sage pl-4">
                  <p className="font-serif-display text-2xl text-charcoal">Artisan Direct</p>
                  <p className="text-xs text-charcoal-soft mt-1">Supporting rural weaver and metalsmith craft clusters.</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 relative">
              <div className="overflow-hidden rounded-3xl shadow-xl aspect-[4/3]">
                <img
                  src="https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=1200&auto=format&fit=crop"
                  alt="Aadya Editorial Interior"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. BEST SELLERS */}
      <section className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">Most Cherished</span>
            <h2 className="mt-1 font-serif-display text-3xl text-charcoal sm:text-4xl">Best Sellers</h2>
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

      {/* 7. SHOP THE LOOK */}
      <section className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-col items-center text-center mb-10">
          <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">Lifestyle Inspiration</span>
          <h2 className="mt-2 font-serif-display text-3xl text-charcoal sm:text-4xl">Shop the Look</h2>
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
              className="group relative overflow-hidden rounded-3xl border border-charcoal/10 bg-white transition hover:shadow-xl"
            >
              <div className="aspect-[3/4] w-full overflow-hidden">
                <img
                  src={look.image}
                  alt={look.title}
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-charcoal/20 to-transparent p-6 flex flex-col justify-end text-ivory">
                <h3 className="font-serif-display text-xl">{look.title}</h3>
                <p className="mt-1 text-xs text-ivory/80">{look.tagline}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-terracotta-light group-hover:underline">
                  View Edit <IconArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 8. BOOKS SECTION */}
      <section className="bg-beige-light/40 py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">Editorial Monographs</span>
              <h2 className="mt-1 font-serif-display text-3xl text-charcoal sm:text-4xl">From Our Bookshelf</h2>
            </div>
            <Link to="/books" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-terracotta hover:underline">
              Explore Books <IconArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {booksList.map((book) => (
              <div key={book.id} className="flex flex-col rounded-2xl border border-charcoal/10 bg-white p-5 shadow-sm">
                <div className="aspect-[3/4] w-full overflow-hidden rounded-xl bg-ivory-dark/40 mb-4">
                  <img src={book.images[0]} alt={book.name} className="h-full w-full object-cover" />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-terracotta">Hardcover Edition</span>
                <h3 className="font-serif-display text-base text-charcoal mt-1 line-clamp-1">{book.name}</h3>
                <p className="text-xs text-charcoal-soft italic mt-0.5">By {book.author}</p>
                <p className="mt-2 text-xs text-charcoal-soft line-clamp-2 leading-relaxed">{book.shortDescription}</p>
                <div className="mt-auto pt-4 flex items-center justify-between border-t border-charcoal/5">
                  <span className="text-sm font-semibold text-terracotta">{formatInr(book.price)}</span>
                  <Link
                    to={`/products/${book.slug}`}
                    className="rounded-full bg-ivory-dark px-3 py-1.5 text-xs font-medium text-charcoal hover:bg-terracotta hover:text-ivory transition"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. WHY AADYA / TRUST STRIP */}
      <section className="border-y border-charcoal/10 bg-ivory py-12">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {[
              { title: "Thoughtfully Curated", desc: "Hand-selected slow design objects for mindful spaces." },
              { title: "Secure Checkout", desc: "100% encrypted payment gateways & COD available." },
              { title: "Pan-India Delivery", desc: "Express plastic-free dispatch to 20,000+ pincodes." },
              { title: "Support When You Need It", desc: "Dedicated concierge care for every customer query." }
            ].map((item) => (
              <div key={item.title} className="text-center sm:text-left space-y-1">
                <div className="mx-auto sm:mx-0 flex h-10 w-10 items-center justify-center rounded-full bg-sage-light text-green-deep mb-2">
                  <IconCheck className="h-5 w-5" />
                </div>
                <h4 className="font-serif-display text-base text-charcoal">{item.title}</h4>
                <p className="text-xs text-charcoal-soft leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 10. NEWSLETTER SECTION */}
      <section className="mx-auto max-w-4xl px-5 sm:px-8 text-center">
        <div className="rounded-3xl border border-charcoal/10 bg-ivory-dark/60 p-8 sm:p-12 space-y-4">
          <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">Join Our Circle</span>
          <h2 className="font-serif-display text-3xl text-charcoal sm:text-4xl">Stories of Craft &amp; New Arrivals</h2>
          <p className="max-w-md mx-auto text-sm text-charcoal-soft leading-relaxed">
            Subscribe to receive quiet reflections, artisan spotlights, and early access to limited edition seasonal drops.
          </p>

          {subscribed ? (
            <div className="rounded-2xl bg-sage-light p-4 text-sm font-medium text-green-deep">
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
                className="flex-1 rounded-full border border-charcoal/15 bg-white px-5 py-3 text-sm text-charcoal focus:outline-none focus:border-terracotta"
              />
              <button
                type="submit"
                disabled={newsletterStatus === "loading"}
                className="rounded-full bg-terracotta px-7 py-3 text-xs font-semibold uppercase tracking-wider text-ivory transition hover:bg-terracotta/90 shrink-0 disabled:opacity-60"
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
    </div>
  );
}
