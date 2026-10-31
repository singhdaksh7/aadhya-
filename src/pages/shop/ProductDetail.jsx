import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import ProductCard from "../../components/ProductCard";
import ProductReviews from "../../components/ProductReviews";
import { PDPSkeleton } from "../../components/ui/Skeleton";
import { formatInr } from "../../lib/format";
import { PincodeCheck } from "../../components/DeliveryEstimate";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
import { useSiteSettings } from "../../hooks/useSiteSettings";
import { commercialContext, shippingInfoText, returnWindowLabel } from "../../lib/commercialText";
import { getProductBySlug, getProducts } from "../../services/api";
import { IconCheck, IconCart } from "../../components/icons";
import { trackProductView, recordRecentlyViewed } from "../../lib/analytics";
import ProductSpecifications from "../../components/shop/ProductSpecifications";
import RecentlyViewed from "../../components/shop/RecentlyViewed";
import { canonicalUrl, jsonLdProps } from "../../lib/seo";

// Concise, settings-driven policy summary for the "Shipping & Returns" tab; full wording lives on the policy pages.
const HANDMADE_HINT = /hand(made|crafted|woven|-woven|\s?embroider|\s?paint|\s?block|\s?stitch)|kantha|kilim|chindi|dhurrie/i;
function ProductPolicyInfo({ product, settings }) {
  const ctx = commercialContext(settings);
  const payments = settings?.payments || {};
  const methods = [
    payments.cashfreeEnabled !== false && payments.cashfreeAvailable !== false ? "online (UPI, cards, net banking)" : "",
    payments.codEnabled ? "cash on delivery where available" : "",
  ].filter(Boolean);
  const returns = returnWindowLabel(ctx);
  const handmade = HANDMADE_HINT.test([product.name, product.shortDescription, product.description, product.materials].filter(Boolean).join(" "));
  const lines = [
    product.shippingInfo || shippingInfoText(ctx) || "Shipping details are shown at checkout.",
    returns ? `Returns: ${returns} on eligible items.` : "",
    methods.length ? `Payment: ${methods.join(" or ")}.` : "",
  ].filter(Boolean);
  return (
    <div className="space-y-3" data-testid="product-policy-info">
      {lines.map((line) => <p key={line}>{line}</p>)}
      {handmade && (
        <p data-testid="handcrafted-note">
          Handcrafted and textile pieces can show small natural differences in weave, print placement, texture, colour or size. These are part of the handmade character and are not defects; damage or a wrong item is handled under our returns policy.
        </p>
      )}
      <p>
        <a href="/shipping" className="underline">Shipping Policy</a> · <a href="/returns" className="underline">Returns &amp; Refunds</a> · <a href="/cancellation" className="underline">Cancellation</a> · <a href="/payments" className="underline">Payment Information</a>
      </p>
    </div>
  );
}

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addItem, items, setIsOpen: setCartDrawerOpen } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const siteSettings = useSiteSettings();
  const { promoStrip } = siteSettings;

  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [addedNotice, setAddedNotice] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [activeCoupons, setActiveCoupons] = useState([]);
  const [bookFormats, setBookFormats] = useState([]);
  const [selectedFormat, setSelectedFormat] = useState(null);

  const wishlisted = product ? isInWishlist(product.id) : false;

  useEffect(() => {
    import("../../lib/api").then((m) => {
      m.listPublicActiveCoupons()
        .then((res) => setActiveCoupons(res.data || []))
        .catch(() => {});
    });
  }, []);

  useEffect(() => {
    let active = true;
    async function loadPDPData() {
      setIsLoading(true);
      setActiveImageIdx(0);
      setQuantity(1);

      const res = await getProductBySlug(slug);
      if (!active) return;

      if (!res.data) {
        setProduct(null);
        setIsLoading(false);
        return;
      }

      const prod = res.data;
      setProduct(prod);
      if (prod.variants?.length) {
        setSelectedVariant(prod.variants[0]);
      }
      trackProductView(prod.id, { slug: prod.slug });
      recordRecentlyViewed(prod);

      if (prod.productType === "BOOK") {
        try {
          const { fetchBookFormats } = await import("../../lib/api");
          const formatsRes = await fetchBookFormats(prod.id);
          const formats = formatsRes.data || [];
          if (active) {
            setBookFormats(formats);
            // Preselect when only one format exists; otherwise the customer
            // must actively choose between Physical and PDF.
            setSelectedFormat(formats.length === 1 ? formats[0].format : null);
          }
        } catch {
          if (active) { setBookFormats([]); setSelectedFormat(null); }
        }
      } else {
        setBookFormats([]);
        setSelectedFormat(null);
      }

      // Load related products from same category or collection
      const relatedRes = await getProducts({ categorySlug: prod.categorySlug });
      if (active) {
        setRelatedProducts(
          (relatedRes.data || []).filter((p) => p.slug !== prod.slug).slice(0, 4)
        );
        setIsLoading(false);
      }
    }

    loadPDPData();
    return () => { active = false; };
  }, [slug]);

  if (isLoading) {
    return (
      <div className="store-bg min-h-screen py-16">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-8">
          <PDPSkeleton />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="store-bg min-h-screen py-24">
        <div className="mx-auto max-w-4xl px-5 text-center sm:px-8">
          <h2 className="font-serif-display text-2xl store-text sm:text-3xl font-bold">Product Not Found</h2>
          <p className="mt-2 text-sm store-muted">The requested object may have been moved or is currently unavailable.</p>
          <Link
            to="/shop"
            className="mt-6 inline-block rounded-full store-bg-primary px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-white"
          >
            Return to Shop
          </Link>
        </div>
      </div>
    );
  }

  const images = product.images?.length
    ? product.images
    : [product.image || "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=1000&auto=format&fit=crop"];

  const hasFormats = bookFormats.length > 0;
  const activeFormatOption = hasFormats ? bookFormats.find((f) => f.format === selectedFormat) : null;
  const inCart = items.find((i) => i.product.slug === product.slug && (i.bookFormat || null) === (selectedFormat || null));
  const stockQty = hasFormats
    ? (activeFormatOption?.format === "PHYSICAL" ? (activeFormatOption.inStock ? 999 : 0) : 999)
    : (product.stockQuantity ?? 10);
  const formatSelectionMissing = hasFormats && !selectedFormat;
  const outOfStock = !hasFormats && (product.inStock === false || stockQty <= 0);
  const maxQty = selectedFormat === "PDF" ? 1 : Math.max(0, stockQty - (inCart?.quantity || 0));

  const price = activeFormatOption ? activeFormatOption.price : Number(product.price);
  const salePrice = activeFormatOption
    ? (activeFormatOption.salePrice ?? null)
    : (product.salePrice ? Number(product.salePrice) : null);
  const onSale = salePrice != null && salePrice < price;
  const discountPercent = onSale ? Math.round(((price - salePrice) / price) * 100) : 0;

  const isBook = product.categorySlug === "books" || product.isbn || product.productType === "BOOK";

  const handleAddToCart = () => {
    if (outOfStock || maxQty <= 0 || formatSelectionMissing) return;
    addItem(product, selectedFormat === "PDF" ? 1 : quantity, selectedVariant, hasFormats ? selectedFormat : null);
    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 2000);
  };

  const handleBuyNow = () => {
    if (outOfStock || maxQty <= 0 || formatSelectionMissing) return;
    addItem(product, selectedFormat === "PDF" ? 1 : quantity, selectedVariant, hasFormats ? selectedFormat : null);
    setCartDrawerOpen(false);
    navigate("/checkout");
  };

  const activeCoupon = activeCoupons[0] || null;

  const pdpUrl = canonicalUrl(`/shop/${product.slug}`);
  const metaDescription = (product.shortDescription || product.story || `${product.name} — handcrafted by Tushaqsa.`).slice(0, 155);
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: metaDescription,
    image: images,
    sku: product.sku || product.id,
    ...(isBook && product.isbn ? { isbn: product.isbn } : {}),
    offers: {
      "@type": "Offer",
      url: pdpUrl,
      priceCurrency: "INR",
      price: (salePrice ?? price).toFixed ? (salePrice ?? price).toFixed(2) : salePrice ?? price,
      availability: outOfStock
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
    },
    ...(product.reviewCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.averageRating,
            reviewCount: product.reviewCount,
          },
        }
      : {}),
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: canonicalUrl("/") },
      { "@type": "ListItem", position: 2, name: "Shop", item: canonicalUrl("/shop") },
      {
        "@type": "ListItem",
        position: 3,
        name: product.category,
        item: canonicalUrl(`/shop/category/${product.categorySlug}`),
      },
      { "@type": "ListItem", position: 4, name: product.name, item: pdpUrl },
    ],
  };

  const handleCopyCode = () => {
    if (activeCoupon?.code) {
      navigator.clipboard.writeText(activeCoupon.code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  return (
    <div className="store-bg store-text py-10 pb-20">
      <title>{`${product.name} | Tushaqsa`}</title>
      <meta name="description" content={metaDescription} />
      <link rel="canonical" href={pdpUrl} />
      <script type="application/ld+json" {...jsonLdProps(productJsonLd)} />
      <script type="application/ld+json" {...jsonLdProps(breadcrumbJsonLd)} />
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-8 space-y-10 lg:space-y-14" data-testid="pdp-container">
        {/* Breadcrumb Header */}
        <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs store-muted">
          <Link to="/" className="hover:text-[var(--theme-primary)]">Home</Link>
          <span>/</span>
          <Link to="/shop" className="hover:text-[var(--theme-primary)]">Shop</Link>
          <span>/</span>
          <Link to={`/shop/category/${product.categorySlug}`} className="hover:text-[var(--theme-primary)]">
            {product.category}
          </Link>
          <span>/</span>
          <span className="store-text font-medium truncate max-w-full" aria-current="page">{product.name}</span>
        </nav>

        {/* Main PDP Grid */}
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-14 items-start" data-testid="pdp-hero">
          {/* Gallery Column (7 cols) */}
          <div className="mx-auto w-full min-w-0 max-w-xl space-y-4 lg:sticky lg:top-24 lg:max-w-none">
            <div data-testid="pdp-gallery-main" className="relative aspect-square w-full overflow-hidden rounded-xl store-surface">
              <img
                src={images[activeImageIdx]}
                alt={product.name}
                className="h-full w-full object-contain transition-opacity duration-300"
              />
              {onSale && (
                <span className="absolute top-4 left-4 rounded-full store-bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-xs">
                  {discountPercent}% OFF
                </span>
              )}
              {product.isNew && (
                <span className="absolute top-4 right-4 rounded-full bg-sage-light px-3 py-1 text-xs font-bold uppercase tracking-wider text-green-deep">
                  New
                </span>
              )}
            </div>

            {/* Gallery Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIdx(idx)}
                    aria-label={`View image ${idx + 1}`}
                    aria-current={idx === activeImageIdx}
                    className={`h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-lg border-2 store-surface transition ${
                      idx === activeImageIdx ? "border-[var(--theme-primary)]" : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img src={img} alt="" className="h-full w-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Purchase Column (5 cols) */}
          <div className="min-w-0 space-y-6" data-testid="pdp-info">
            <div className="space-y-2 border-b border-[var(--theme-border)] pb-6">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-semibold uppercase tracking-widest store-primary">
                  {product.category} {product.collection ? `• ${product.collection}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => toggleWishlist(product.id)}
                  aria-label={wishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--theme-border)] store-surface transition hover:scale-105 shadow-xs ${
                    wishlisted ? "border-[var(--theme-primary)] store-primary bg-[var(--theme-primary-soft)]" : "store-muted hover:text-[var(--theme-primary)]"
                  }`}
                >
                  <svg className="h-4 w-4" fill={wishlisted ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.684a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
              </div>
              <h1 className="font-serif-display text-3xl sm:text-4xl store-text font-bold leading-tight break-words">
                {product.name}
              </h1>
              {product.reviewCount > 0 && (
                <a href="#pdp-reviews" data-testid="pdp-rating" className="inline-flex items-center gap-2 text-xs store-muted hover:text-[var(--theme-primary)]">
                  <span className="store-primary font-semibold">{Number(product.averageRating).toFixed(1)} ★</span>
                  <span>{product.reviewCount} {product.reviewCount === 1 ? "review" : "reviews"}</span>
                </a>
              )}
              {isBook && product.author && (
                <p className="text-sm store-muted italic">By {product.author}</p>
              )}

              {/* Price & MRP / Sale */}
              <div className="pt-2 flex items-baseline gap-3">
                <span data-testid="pdp-price" className="text-3xl sm:text-4xl font-bold store-primary">
                  {formatInr(salePrice ?? price)}
                </span>
                {onSale && (
                  <span className="text-lg store-muted line-through">
                    {formatInr(price)}
                  </span>
                )}
              </div>
              <p className="text-xs font-medium store-muted pt-1">
                {outOfStock ? (
                  <span className="store-primary font-semibold">Currently Sold Out</span>
                ) : stockQty <= 5 ? (
                  <span className="store-primary font-semibold">Low Stock — Only {stockQty} remaining</span>
                ) : (
                  <span className="text-sage font-semibold">
                    In Stock{commercialContext(siteSettings).dispatchEstimate ? ` • Dispatched within ${commercialContext(siteSettings).dispatchEstimate}` : ""}
                  </span>
                )}
              </p>
            </div>

            {/* Short Description */}
            {product.shortDescription && (
              <p className="text-sm leading-relaxed store-muted">{product.shortDescription}</p>
            )}

            {/* PDP Promo / Coupon Box */}
            {activeCoupon && (
              <div className="rounded-xl border border-dashed border-[var(--theme-primary)]/40 store-surface p-4 flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <p className="font-semibold store-text">{activeCoupon.name || "Available Offer"}</p>
                  <p className="store-muted text-[11px]">
                    {activeCoupon.description ||
                      (activeCoupon.discountType === "PERCENTAGE"
                        ? `Get ${activeCoupon.value}% off on your purchase`
                        : `Get ₹${activeCoupon.value} off on your purchase`)}
                  </p>
                </div>
                <button
                  onClick={handleCopyCode}
                  className="rounded-lg store-bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95 transition shrink-0 font-mono"
                >
                  {codeCopied ? "Copied!" : `Use ${activeCoupon.code}`}
                </button>
              </div>
            )}

            {/* Book Format Selector — Physical vs PDF/Digital */}
            {hasFormats && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider store-muted">Choose Format</label>
                <div className="flex flex-wrap gap-2">
                  {bookFormats.map((f) => (
                    <button
                      key={f.format}
                      type="button"
                      aria-pressed={selectedFormat === f.format}
                      onClick={() => setSelectedFormat(f.format)}
                      className={`rounded-full px-4 py-2 text-xs font-medium border transition ${
                        selectedFormat === f.format
                          ? "border-[var(--theme-primary)] store-bg-primary text-white"
                          : "border-[var(--theme-border)] store-surface store-text hover:border-[var(--theme-text)]"
                      }`}
                    >
                      {f.format === "PHYSICAL" ? "Physical Book" : "PDF / Digital"} — {formatInr(f.effectivePrice)}
                    </button>
                  ))}
                </div>
                {formatSelectionMissing && (
                  <p className="text-xs store-primary">Select a format to continue.</p>
                )}
              </div>
            )}

            {/* Variant Selector */}
            {!hasFormats && product.variants?.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider store-muted">Select Finish / Option</label>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariant(v)}
                      className={`rounded-full px-4 py-2 text-xs font-medium border transition ${
                        selectedVariant?.id === v.id
                          ? "border-[var(--theme-primary)] store-bg-primary text-white"
                          : "border-[var(--theme-border)] store-surface store-text hover:border-[var(--theme-text)]"
                      }`}
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity & CTAs */}
            {!outOfStock && (
              <div className="space-y-4 pt-2">
                {selectedFormat !== "PDF" && (
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-semibold uppercase tracking-wider store-muted">Quantity</span>
                    <div className="flex items-center rounded-full border border-[var(--theme-border)] store-surface px-3 py-1">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="px-2 text-base font-bold store-text hover:text-[var(--theme-primary)]"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm font-semibold store-text">{quantity}</span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        onClick={() => setQuantity((q) => Math.min(stockQty, q + 1))}
                        className="px-2 text-base font-bold store-text hover:text-[var(--theme-primary)]"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
                {selectedFormat === "PDF" && (
                  <p className="text-xs store-muted">Digital books are limited to one copy per order.</p>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    onClick={handleAddToCart}
                    disabled={maxQty <= 0 || formatSelectionMissing}
                    className={`flex items-center justify-center gap-2 rounded-full py-3.5 text-xs font-semibold uppercase tracking-wider transition shadow-xs ${
                      addedNotice
                        ? "bg-sage text-white"
                        : "store-bg-primary text-white hover:brightness-95"
                    }`}
                  >
                    {addedNotice ? <><IconCheck className="h-4 w-4" /> Added</> : <><IconCart className="h-4 w-4" /> Add to Cart</>}
                  </button>
                  <button
                    onClick={handleBuyNow}
                    disabled={maxQty <= 0}
                    className="rounded-full border border-[var(--theme-text)] bg-[var(--theme-text)] py-3.5 text-xs font-semibold uppercase tracking-wider text-white transition hover:opacity-90 shadow-xs"
                  >
                    Buy Now
                  </button>
                </div>
              </div>
            )}

            {selectedFormat !== "PDF" && (
              <div className="border-t border-[var(--theme-border)] pt-4">
                <PincodeCheck items={[{ slug: product.slug, quantity: 1, ...(selectedVariant?.id ? { variantId: selectedVariant.id } : {}) }]} />
              </div>
            )}

            {/* Trust Guarantees */}
            {(() => {
              const c = commercialContext(siteSettings);
              const facts = [returnWindowLabel(c), c.deliveryEstimate ? `Delivery in ${c.deliveryEstimate}` : ""].filter(Boolean);
              return facts.length ? (
                <div className="border-t border-[var(--theme-border)] pt-4 grid grid-cols-2 gap-3 text-xs store-muted" data-testid="pdp-facts">
                  {facts.map((fact) => (
                    <div key={fact} className="flex items-center gap-2">
                      <span className="store-primary font-bold">✓</span>
                      <span>{fact}</span>
                    </div>
                  ))}
                </div>
              ) : null;
            })()}
          </div>
        </div>

        {/* Detail sections: only those with content render. */}
        <div className="space-y-10 max-w-4xl" data-testid="pdp-details">
          {product.story && (
            <section data-testid="pdp-description" aria-labelledby="pdp-desc-heading" className="border-t border-[var(--theme-border)] pt-10">
              <h2 id="pdp-desc-heading" className="font-serif-display text-xl sm:text-2xl store-text font-bold">Description</h2>
              <p className="mt-4 whitespace-pre-line break-words text-sm leading-relaxed store-muted">{product.story}</p>
            </section>
          )}

          <ProductSpecifications product={product} />

          {product.careInstructions && (
            <section data-testid="pdp-care" aria-labelledby="pdp-care-heading" className="border-t border-[var(--theme-border)] pt-10">
              <h2 id="pdp-care-heading" className="font-serif-display text-xl sm:text-2xl store-text font-bold">Care</h2>
              <p className="mt-4 whitespace-pre-line break-words text-sm leading-relaxed store-muted">{product.careInstructions}</p>
            </section>
          )}

          <section data-testid="pdp-shipping-returns" aria-labelledby="pdp-ship-heading" className="border-t border-[var(--theme-border)] pt-10">
            <h2 id="pdp-ship-heading" className="font-serif-display text-xl sm:text-2xl store-text font-bold">Shipping &amp; Returns</h2>
            <div className="mt-4 text-sm leading-relaxed store-muted">
              <ProductPolicyInfo product={product} settings={siteSettings} />
            </div>
          </section>
        </div>

        {/* Product Reviews Section */}
        <section id="pdp-reviews" className="border-t border-[var(--theme-border)] pt-12 scroll-mt-24">
          <ProductReviews productId={product.id} />
        </section>

        {/* Related Products Section */}
        {relatedProducts.length > 0 && (
          <section className="border-t border-[var(--theme-border)] pt-12">
            <div className="mb-8">
              <span className="text-xs font-semibold uppercase tracking-widest store-primary">Curated Recommendations</span>
              <h2 className="font-serif-display text-2xl sm:text-3xl store-text font-bold mt-1">You May Also Cherish</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
              {relatedProducts.map((rel) => (
                <ProductCard key={rel.id} product={rel} />
              ))}
            </div>
          </section>
        )}

        <RecentlyViewed excludeSlug={product.slug} />
      </div>

      {/* Mobile Sticky Purchase Bar (<768px) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--theme-border)] store-bg px-4 py-3 shadow-2xl backdrop-blur-md md:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-serif-display font-medium store-text">{product.name}</p>
            <p className="text-sm font-bold store-primary">{formatInr(salePrice ?? price)}</p>
          </div>
          <button
            onClick={handleAddToCart}
            disabled={outOfStock || maxQty <= 0}
            className={`flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white shadow-xs transition ${
              addedNotice
                ? "bg-sage"
                : outOfStock || maxQty <= 0
                ? "bg-[var(--theme-border)] text-[var(--theme-muted)] cursor-not-allowed"
                : "store-bg-primary hover:brightness-95"
            }`}
          >
            {addedNotice ? (
              <><IconCheck className="h-3.5 w-3.5" /> Added</>
            ) : outOfStock ? (
              "Sold Out"
            ) : (
              <><IconCart className="h-3.5 w-3.5" /> Add to Cart</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
