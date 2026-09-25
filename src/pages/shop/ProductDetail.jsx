import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import ProductCard from "../../components/ProductCard";
import { PDPSkeleton } from "../../components/ui/Skeleton";
import { formatInr } from "../../lib/format";
import { useCart } from "../../context/CartContext";
import { getProductBySlug, getProducts } from "../../services/api";
import { IconCheck, IconCart } from "../../components/icons";

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addItem, items, setIsOpen: setCartDrawerOpen } = useCart();

  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState("story");
  const [isLoading, setIsLoading] = useState(true);
  const [addedNotice, setAddedNotice] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadPDPData() {
      setIsLoading(true);
      setActiveImageIdx(0);
      setQuantity(1);
      setActiveTab("story");

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
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <PDPSkeleton />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-24 text-center sm:px-8">
        <h2 className="font-serif-display text-2xl text-charcoal sm:text-3xl">Product Not Found</h2>
        <p className="mt-2 text-sm text-charcoal-soft">The requested object may have been moved or is currently unavailable.</p>
        <Link
          to="/shop"
          className="mt-6 inline-block rounded-full bg-terracotta px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-ivory"
        >
          Return to Shop
        </Link>
      </div>
    );
  }

  const images = product.images?.length
    ? product.images
    : [product.image || "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=1000&auto=format&fit=crop"];

  const inCart = items.find((i) => i.product.slug === product.slug);
  const stockQty = product.stockQuantity ?? 10;
  const outOfStock = product.inStock === false || stockQty <= 0;
  const maxQty = Math.max(0, stockQty - (inCart?.quantity || 0));

  const price = Number(product.price);
  const salePrice = product.salePrice ? Number(product.salePrice) : null;
  const onSale = salePrice != null && salePrice < price;
  const discountPercent = onSale ? Math.round(((price - salePrice) / price) * 100) : 0;

  const isBook = product.categorySlug === "books" || product.isbn;

  const handleAddToCart = () => {
    if (outOfStock || maxQty <= 0) return;
    addItem(product, quantity, selectedVariant);
    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 2000);
  };

  const handleBuyNow = () => {
    if (outOfStock || maxQty <= 0) return;
    addItem(product, quantity, selectedVariant);
    setCartDrawerOpen(false);
    navigate("/checkout");
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 space-y-16">
      {/* Breadcrumb Header */}
      <nav className="flex items-center gap-2 text-xs text-charcoal-soft">
        <Link to="/" className="hover:text-terracotta">Home</Link>
        <span>/</span>
        <Link to="/shop" className="hover:text-terracotta">Shop</Link>
        <span>/</span>
        <Link to={`/collections/${product.categorySlug}`} className="hover:text-terracotta">
          {product.category}
        </Link>
        <span>/</span>
        <span className="text-charcoal font-medium truncate">{product.name}</span>
      </nav>

      {/* Main PDP Grid */}
      <div className="grid gap-12 lg:grid-cols-12 items-start">
        {/* Gallery Column (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-charcoal/10 bg-ivory-dark/40 shadow-sm">
            <img
              src={images[activeImageIdx]}
              alt={product.name}
              className="h-full w-full object-cover transition-all duration-500"
            />
            {onSale && (
              <span className="absolute top-4 left-4 rounded-full bg-terracotta px-3 py-1 text-xs font-bold uppercase tracking-wider text-ivory">
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
            <div className="relative group/thumbs">
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIdx(idx)}
                    className={`h-20 w-20 shrink-0 snap-start overflow-hidden rounded-2xl border-2 transition ${
                      idx === activeImageIdx ? "border-terracotta scale-95" : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
              {/* Fade gradient masks on edges for visual scroll hint */}
              <div className="pointer-events-none absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-ivory via-ivory/40 to-transparent" />
            </div>
          )}
        </div>

        {/* Product Purchase Column (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-2 border-b border-charcoal/10 pb-6">
            <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">
              {product.category} {product.collection ? `• ${product.collection}` : ""}
            </span>
            <h1 className="font-serif-display text-3xl text-charcoal leading-tight">
              {product.name}
            </h1>
            {isBook && product.author && (
              <p className="text-sm text-charcoal-soft italic">By {product.author}</p>
            )}

            {/* Price & Stock */}
            <div className="pt-2 flex items-baseline gap-3">
              <span className="text-3xl font-bold text-terracotta">
                {formatInr(salePrice ?? price)}
              </span>
              {onSale && (
                <span className="text-lg text-charcoal-soft line-through">
                  {formatInr(price)}
                </span>
              )}
            </div>
            <p className="text-xs font-medium text-charcoal-soft pt-1">
              {outOfStock ? (
                <span className="text-terracotta font-semibold">Currently Sold Out</span>
              ) : stockQty <= 5 ? (
                <span className="text-terracotta font-semibold">Low Stock — Only {stockQty} remaining</span>
              ) : (
                <span className="text-sage font-semibold">In Stock • Dispatched in 24h</span>
              )}
            </p>
          </div>

          {/* Short Description */}
          <p className="text-sm leading-relaxed text-charcoal-soft">
            {product.shortDescription || product.story}
          </p>

          {/* Variant Selector */}
          {product.variants?.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Select Finish / Option</label>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
                    className={`rounded-full px-4 py-2 text-xs font-medium border transition ${
                      selectedVariant?.id === v.id
                        ? "border-terracotta bg-terracotta text-ivory"
                        : "border-charcoal/20 bg-white text-charcoal hover:border-charcoal"
                    }`}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Book Details Quick Grid */}
          {isBook && (
            <div className="rounded-2xl border border-charcoal/10 bg-ivory-dark/40 p-4 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-charcoal-soft">ISBN:</span> <span className="font-medium text-charcoal">{product.isbn || "978-81-945201"}</span></div>
                <div><span className="text-charcoal-soft">Publisher:</span> <span className="font-medium text-charcoal">{product.publisher || "Aadya Editorial Press"}</span></div>
                <div><span className="text-charcoal-soft">Pages:</span> <span className="font-medium text-charcoal">{product.pages || product.pageCount || 240}</span></div>
                <div><span className="text-charcoal-soft">Language:</span> <span className="font-medium text-charcoal">{product.language || "English"}</span></div>
                <div><span className="text-charcoal-soft">Edition:</span> <span className="font-medium text-charcoal">{product.edition || "Collector Hardcover"}</span></div>
                <div><span className="text-charcoal-soft">Year:</span> <span className="font-medium text-charcoal">{product.publicationYear || 2025}</span></div>
              </div>
            </div>
          )}

          {/* Quantity & CTA Buttons */}
          {!outOfStock && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Quantity</span>
                <div className="flex items-center rounded-full border border-charcoal/20 bg-white px-3 py-1">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="px-2 text-base font-bold text-charcoal hover:text-terracotta"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-semibold text-charcoal">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(stockQty, q + 1))}
                    className="px-2 text-base font-bold text-charcoal hover:text-terracotta"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleAddToCart}
                  disabled={maxQty <= 0}
                  className={`flex items-center justify-center gap-2 rounded-full py-3.5 text-xs font-semibold uppercase tracking-wider transition shadow ${
                    addedNotice
                      ? "bg-sage text-ivory"
                      : "bg-terracotta text-ivory hover:bg-terracotta/90"
                  }`}
                >
                  {addedNotice ? <><IconCheck className="h-4 w-4" /> Added</> : <><IconCart className="h-4 w-4" /> Add to Cart</>}
                </button>
                <button
                  onClick={handleBuyNow}
                  disabled={maxQty <= 0}
                  className="rounded-full border border-charcoal bg-charcoal py-3.5 text-xs font-semibold uppercase tracking-wider text-ivory transition hover:bg-charcoal/90 shadow"
                >
                  Buy Now
                </button>
              </div>
            </div>
          )}

          {/* Trust Guarantees */}
          <div className="border-t border-charcoal/10 pt-4 grid grid-cols-2 gap-3 text-xs text-charcoal-soft">
            <div className="flex items-center gap-2">
              <span className="text-terracotta font-bold">✓</span>
              <span>100% Eco Cotton Packaging</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-terracotta font-bold">✓</span>
              <span>Pan-India Insured Transit</span>
            </div>
          </div>
        </div>
      </div>

      {/* Accordion Tabs Section */}
      <section className="border-t border-charcoal/10 pt-10">
        <div className="flex border-b border-charcoal/10 gap-8 overflow-x-auto text-sm font-medium">
          {[
            { id: "story", label: "Product Story & Craft" },
            { id: "specs", label: "Materials & Specs" },
            { id: "care", label: "Care Instructions" },
            { id: "shipping", label: "Shipping & Returns" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-xs font-semibold uppercase tracking-wider transition border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-terracotta text-terracotta"
                  : "border-transparent text-charcoal-soft hover:text-charcoal"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="py-6 text-sm leading-relaxed text-charcoal-soft max-w-3xl">
          {activeTab === "story" && (
            <p className="whitespace-pre-line">{product.story || product.shortDescription}</p>
          )}
          {activeTab === "specs" && (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><dt className="font-semibold text-charcoal">Materials:</dt><dd>{product.materials || "Natural Raw Materials"}</dd></div>
              <div><dt className="font-semibold text-charcoal">Dimensions:</dt><dd>{product.dimensions || "Standard Size"}</dd></div>
              <div><dt className="font-semibold text-charcoal">Weight:</dt><dd>{product.weight || "N/A"}</dd></div>
              <div><dt className="font-semibold text-charcoal">Origin:</dt><dd>Master Artisan Workshops, India</dd></div>
            </dl>
          )}
          {activeTab === "care" && (
            <p>{product.careInstructions || "Wipe gently with a soft dry cloth. Avoid harsh chemicals."}</p>
          )}
          {activeTab === "shipping" && (
            <p>{product.shippingInfo || "Dispatched within 24-48 hours via premium courier. Easy 7-day returns for defective items."}</p>
          )}
        </div>
      </section>

      {/* Related Products Section */}
      {relatedProducts.length > 0 && (
        <section className="border-t border-charcoal/10 pt-12">
          <div className="mb-8">
            <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">Curated Recommendations</span>
            <h2 className="font-serif-display text-2xl text-charcoal sm:text-3xl mt-1">You May Also Cherish</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {relatedProducts.map((rel) => (
              <ProductCard key={rel.id} product={rel} />
            ))}
          </div>
        </section>
      )}

      {/* Mobile Sticky Purchase Bar (<768px) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-charcoal/10 bg-ivory/95 px-4 py-3 shadow-2xl backdrop-blur-md md:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-serif-display font-medium text-charcoal">{product.name}</p>
            <p className="text-sm font-bold text-terracotta">{formatInr(salePrice ?? price)}</p>
          </div>
          <button
            onClick={handleAddToCart}
            disabled={outOfStock || maxQty <= 0}
            className={`flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-ivory shadow transition ${
              addedNotice
                ? "bg-sage"
                : outOfStock || maxQty <= 0
                ? "bg-charcoal/30 text-charcoal/50 cursor-not-allowed"
                : "bg-terracotta hover:bg-terracotta/90"
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
