import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchProductBySlug } from "../lib/api";
import { fetchBookFormats } from "../lib/api";
import { formatInr } from "../lib/format";
import { useOptionalCart } from "../context/CartContext";

const enabled = (items = []) => items.filter((item) => item.enabled !== false).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

export default function EditorialProductSection({ section }) {
  const s = section.settings || {};
  const cart = useOptionalCart();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(Boolean(s.productId));
  const [formats, setFormats] = useState([]);

  useEffect(() => {
    let active = true;
    if (!s.productId) { setProduct(null); setFormats([]); setLoading(false); return undefined; }
    setLoading(true);
    fetchProductBySlug(s.productId).then(async (res) => {
      const current = res.data;
      if (!active) return;
      setProduct(current);
      if (current?.productType === "BOOK") {
        try { const formatRes = await fetchBookFormats(current.id); if (active) setFormats(formatRes.data || []); } catch { if (active) setFormats([]); }
      } else setFormats([]);
    }).catch(() => { if (active) { setProduct(null); setFormats([]); } }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [s.productId]);

  const activeFormats = formats.filter((format) => format.isActive !== false);
  const hasMultipleBookFormats = product?.productType === "BOOK" && activeFormats.length > 1;
  const selectedFormat = activeFormats.length === 1 ? activeFormats[0] : null;
  const unavailable = !product || product.isActive === false || (selectedFormat?.format === "PHYSICAL" ? !selectedFormat.inStock : product.trackInventory && product.stockQuantity <= 0);
  const action = s.ctaAction || "BUY_NOW";
  const label = unavailable ? "Out of Stock" : (s.ctaLabel || "Buy Now");
  const click = async () => {
    if (!product || unavailable) return;
    if (action === "VIEW_PRODUCT" || hasMultipleBookFormats) return navigate(`/shop/${product.slug}`);
    if (!cart) return;
    await cart.addItem(product, 1, null, selectedFormat?.format || null);
    if (action === "BUY_NOW") { cart.setIsOpen(false); navigate("/checkout"); }
  };
  const showCta = s.ctaEnabled !== false && product && !loading;
  const currentPrice = selectedFormat ? (selectedFormat.salePrice ?? selectedFormat.price) : (product?.salePrice ?? product?.price);
  const originalPrice = selectedFormat ? selectedFormat.price : product?.price;
  const image = s.image || product?.image;
  return <section className="mx-auto max-w-7xl px-4 py-8 sm:px-8"><div className="grid items-center gap-8 rounded-2xl border store-border store-surface p-6 sm:gap-12 sm:p-12 lg:grid-cols-12"><div className="space-y-6 lg:col-span-6"><span className="text-xs font-semibold uppercase tracking-widest store-primary">{s.eyebrow}</span><h2 className="font-serif-display text-3xl font-bold store-text sm:text-4xl lg:text-5xl">{s.title}</h2>{s.body && <p className="text-sm leading-relaxed store-text sm:text-base">{s.body}</p>}<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{enabled(s.features || []).map((feature) => <div key={feature.id || feature.title} className={`border-l-2 pl-4 ${feature.accent === "SAGE" ? "border-[var(--theme-secondary)]" : "border-[var(--theme-primary)]"}`}><p className="font-serif-display text-xl font-bold store-text">{feature.title}</p><p className="mt-1 text-xs store-muted">{feature.description}</p></div>)}</div>{product && <div className="border-t store-border pt-5"><p className="text-[10px] font-semibold uppercase tracking-widest store-primary">Featured Object</p><Link to={`/shop/${product.slug}`} className="mt-1 block font-serif-display text-xl font-bold store-text hover:store-primary">{product.name}</Link><div className="mt-1 flex items-baseline gap-2"><span className="text-base font-bold store-primary">{formatInr(currentPrice)}</span>{currentPrice != null && originalPrice != null && Number(currentPrice) < Number(originalPrice) && <span className="text-xs store-muted line-through">{formatInr(originalPrice)}</span>}</div>{showCta && <button type="button" onClick={click} disabled={unavailable || !cart} className="mt-4 rounded-full store-bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-wider text-white transition store-primary-hover disabled:cursor-not-allowed disabled:opacity-40">{label}</button>}{hasMultipleBookFormats && <p className="mt-2 text-xs store-muted">Choose a format on the product page.</p>}</div>}</div><div className="overflow-hidden rounded-2xl shadow-lg lg:col-span-6">{image && <img src={image} alt={s.imageAlt || product?.name || s.title || "Editorial image"} className="aspect-[4/3] h-full w-full object-cover" />}</div></div></section>;
}
