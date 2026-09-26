import { useEffect, useState } from "react";
import { adminFetchSiteSettings, adminUpdateSiteSettings } from "../../lib/api";
import { Button } from "../../components/ui";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";

const emptyForm = {
  announcementText: "",
  announcementActive: true,
  freeShippingThreshold: "2499",
  standardShippingAmount: "99",
  supportPhone: "",
  supportEmail: "",
  // Promo Strip
  promoActive: true,
  promoDescription: "Get ₹500 off on your first purchase above ₹2,999",
  promoCouponCode: "AADYA500",
  promoCtaLabel: "Shop Now",
  promoCtaUrl: "/shop",
  // Hero Banner 1
  hero1Headline: "Decor that",
  hero1Highlight: "Feels Like Home",
  hero1Description: "Discover handcrafted oil lamps, unglazed clay vessels, linen textiles, and slow design objects created for peaceful sanctuaries.",
  hero1PrimaryCtaLabel: "Shop Home Decor",
  hero1PrimaryCtaUrl: "/shop",
  hero1DesktopImage: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=1800&auto=format&fit=crop",
  hero1MobileImage: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=800&auto=format&fit=crop",
  hero1Active: true
};

export default function AdminSettings() {
  const [status, setStatus] = useState("loading");
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    adminFetchSiteSettings()
      .then((res) => {
        const s = res.data || {};
        const promo = s.promoStrip || {};
        const banners = s.heroBanners || [];
        const hero1 = banners[0] || {};

        setForm({
          announcementText: s.announcementBar?.text || "",
          announcementActive: s.announcementBar?.active ?? true,
          freeShippingThreshold: s.freeShippingThreshold != null ? String(s.freeShippingThreshold) : "2499",
          standardShippingAmount: s.standardShippingAmount != null ? String(s.standardShippingAmount) : "99",
          supportPhone: s.supportPhone || "",
          supportEmail: s.supportEmail || "",
          // Promo Strip
          promoActive: promo.active ?? true,
          promoDescription: promo.description || "Get ₹500 off on your first purchase above ₹2,999",
          promoCouponCode: promo.couponCode || "AADYA500",
          promoCtaLabel: promo.ctaLabel || "Shop Now",
          promoCtaUrl: promo.ctaUrl || "/shop",
          // Hero Banner
          hero1Headline: hero1.headline || "Decor that",
          hero1Highlight: hero1.highlightText || "Feels Like Home",
          hero1Description: hero1.description || "Discover handcrafted oil lamps, unglazed clay vessels, linen textiles, and slow design objects created for peaceful sanctuaries.",
          hero1PrimaryCtaLabel: hero1.primaryCtaLabel || "Shop Home Decor",
          hero1PrimaryCtaUrl: hero1.primaryCtaUrl || "/shop",
          hero1DesktopImage: hero1.desktopImage || "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=1800&auto=format&fit=crop",
          hero1MobileImage: hero1.mobileImage || "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=800&auto=format&fit=crop",
          hero1Active: hero1.active ?? true
        });
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const payload = {
      announcementBar: { text: form.announcementText, active: form.announcementActive },
      freeShippingThreshold: Number(form.freeShippingThreshold) || 0,
      standardShippingAmount: Number(form.standardShippingAmount) || 0,
      promoStrip: {
        active: form.promoActive,
        description: form.promoDescription,
        couponCode: form.promoCouponCode,
        ctaLabel: form.promoCtaLabel,
        ctaUrl: form.promoCtaUrl,
        background: "#FAF6F0"
      },
      heroBanners: [
        {
          id: "hero-1",
          eyebrow: "Aadya Home & Lifestyle",
          headline: form.hero1Headline,
          highlightText: form.hero1Highlight,
          description: form.hero1Description,
          primaryCtaLabel: form.hero1PrimaryCtaLabel,
          primaryCtaUrl: form.hero1PrimaryCtaUrl,
          secondaryCtaLabel: "Explore Collections",
          secondaryCtaUrl: "/collections",
          desktopImage: form.hero1DesktopImage,
          mobileImage: form.hero1MobileImage,
          textPosition: "LEFT",
          textTheme: "DARK",
          active: form.hero1Active
        }
      ]
    };
    if (form.supportPhone) payload.supportPhone = form.supportPhone;
    if (form.supportEmail) payload.supportEmail = form.supportEmail;
    try {
      await adminUpdateSiteSettings(payload);
      setSaved(true);
    } catch (err) {
      setError(err.message || "Could not save settings.");
    }
  };

  if (status === "loading") return <LoadingNotice />;
  if (status === "error") return <ErrorNotice message="Unable to load settings." />;

  return (
    <div className="space-y-6">
      <h1 className="font-serif-display text-2xl text-charcoal font-bold">Site & Merchandising Settings</h1>

      <form onSubmit={onSubmit} className="max-w-2xl space-y-6">
        {/* 1. Global Announcement & Shipping */}
        <div className="rounded-2xl border border-charcoal/10 bg-white p-5 space-y-4 shadow-xs">
          <h2 className="font-serif text-lg font-semibold text-charcoal">Announcement & Shipping</h2>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-terracotta">Announcement Bar</p>
            <input
              placeholder="Announcement text"
              value={form.announcementText}
              onChange={(e) => setForm((f) => ({ ...f, announcementText: e.target.value }))}
              className={inputCls}
            />
            <label className="mt-2 flex items-center gap-2 text-sm text-charcoal cursor-pointer">
              <input
                type="checkbox"
                checked={form.announcementActive}
                onChange={(e) => setForm((f) => ({ ...f, announcementActive: e.target.checked }))}
              />
              Show on storefront top header
            </label>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-terracotta">Shipping Rules</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-charcoal-soft">Free Shipping Minimum (₹)</label>
                <input
                  type="number"
                  placeholder="2499"
                  value={form.freeShippingThreshold}
                  onChange={(e) => setForm((f) => ({ ...f, freeShippingThreshold: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs text-charcoal-soft">Standard Shipping Fee (₹)</label>
                <input
                  type="number"
                  placeholder="99"
                  value={form.standardShippingAmount}
                  onChange={(e) => setForm((f) => ({ ...f, standardShippingAmount: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 2. Coupon Promo Strip Management */}
        <div className="rounded-2xl border border-charcoal/10 bg-white p-5 space-y-4 shadow-xs">
          <h2 className="font-serif text-lg font-semibold text-charcoal">Promotional Strip & Coupon Merchandising</h2>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-terracotta">Promo Offer Description</label>
            <input
              placeholder="e.g. Get ₹500 off on your first purchase"
              value={form.promoDescription}
              onChange={(e) => setForm((f) => ({ ...f, promoDescription: e.target.value }))}
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-charcoal-soft">Coupon Code</label>
              <input
                placeholder="AADYA500"
                value={form.promoCouponCode}
                onChange={(e) => setForm((f) => ({ ...f, promoCouponCode: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-charcoal-soft">CTA Link URL</label>
              <input
                placeholder="/shop"
                value={form.promoCtaUrl}
                onChange={(e) => setForm((f) => ({ ...f, promoCtaUrl: e.target.value }))}
                className={inputCls}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-charcoal cursor-pointer">
            <input
              type="checkbox"
              checked={form.promoActive}
              onChange={(e) => setForm((f) => ({ ...f, promoActive: e.target.checked }))}
            />
            Show Promotional Coupon Strip on Home Page
          </label>
        </div>

        {/* 3. Hero Banner Management */}
        <div className="rounded-2xl border border-charcoal/10 bg-white p-5 space-y-4 shadow-xs">
          <h2 className="font-serif text-lg font-semibold text-charcoal">Hero Banner Merchandising</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-charcoal-soft">Headline Line 1</label>
              <input
                placeholder="Decor that"
                value={form.hero1Headline}
                onChange={(e) => setForm((f) => ({ ...f, hero1Headline: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-charcoal-soft">Highlight Line 2 (Italic)</label>
              <input
                placeholder="Feels Like Home"
                value={form.hero1Highlight}
                onChange={(e) => setForm((f) => ({ ...f, hero1Highlight: e.target.value }))}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-charcoal-soft">Banner Description</label>
            <textarea
              rows={2}
              value={form.hero1Description}
              onChange={(e) => setForm((f) => ({ ...f, hero1Description: e.target.value }))}
              className={inputCls}
            />
          </div>

          <div>
            <label className="text-xs text-charcoal-soft">Desktop Image URL</label>
            <input
              placeholder="https://..."
              value={form.hero1DesktopImage}
              onChange={(e) => setForm((f) => ({ ...f, hero1DesktopImage: e.target.value }))}
              className={inputCls}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-charcoal cursor-pointer">
            <input
              type="checkbox"
              checked={form.hero1Active}
              onChange={(e) => setForm((f) => ({ ...f, hero1Active: e.target.checked }))}
            />
            Enable Hero Carousel Banner
          </label>
        </div>

        {/* Support Contact */}
        <div className="rounded-2xl border border-charcoal/10 bg-white p-5 space-y-4 shadow-xs">
          <h2 className="font-serif text-lg font-semibold text-charcoal">Support Contact</h2>
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Support phone"
              value={form.supportPhone}
              onChange={(e) => setForm((f) => ({ ...f, supportPhone: e.target.value }))}
              className={inputCls}
            />
            <input
              placeholder="Support email"
              value={form.supportEmail}
              onChange={(e) => setForm((f) => ({ ...f, supportEmail: e.target.value }))}
              className={inputCls}
            />
          </div>
        </div>

        {error && <p className="text-sm font-semibold text-terracotta">{error}</p>}
        {saved && <p className="text-sm font-semibold text-green-deep">Settings successfully saved!</p>}

        <Button>Save All Merchandising Settings</Button>
      </form>
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-charcoal/15 px-4 py-2.5 text-sm focus:border-terracotta focus:outline-none bg-white";
