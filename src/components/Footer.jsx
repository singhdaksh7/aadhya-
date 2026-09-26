import React from "react";
import { Link } from "react-router-dom";
import { useSiteSettings } from "../hooks/useSiteSettings";

export default function Footer() {
  const { footer, general, social, branding, supportEmail, supportPhone } = useSiteSettings();

  const brandDesc = footer?.brandDescription || general?.shortDescription || "Aadya is a premium Indian home decor and lifestyle brand. We create and curate objects for thoughtful living — celebrating slow craft, natural minerals, and artisan traditions.";
  const email = general?.supportEmail || supportEmail || "concierge@aadyahome.com";
  const phone = general?.supportPhone || supportPhone || "+91 (800) 242-3921";
  const address = general?.businessAddress ? `${general.businessAddress}, ${general.city || ""}` : "Crafted with care in India";

  // Social links filter
  const socialList = [
    { key: "instagram", label: "Instagram", url: social?.instagram },
    { key: "facebook", label: "Facebook", url: social?.facebook },
    { key: "youtube", label: "YouTube", url: social?.youtube },
    { key: "pinterest", label: "Pinterest", url: social?.pinterest },
    { key: "linkedin", label: "LinkedIn", url: social?.linkedin },
    { key: "twitter", label: "X/Twitter", url: social?.twitter },
  ].filter((s) => Boolean(s.url && s.url.trim()));

  // Default columns fallback
  const defaultColumns = [
    {
      id: "fc-1",
      title: "Shop",
      links: [
        { label: "Home Decor", url: "/shop" },
        { label: "Handcrafted Decor", url: "/collections/handcrafted-decor" },
        { label: "Wellness Decor", url: "/collections/wellness-decor" },
        { label: "Books & Monographs", url: "/books" },
        { label: "New Arrivals", url: "/new-arrivals" },
        { label: "Best Sellers", url: "/best-sellers" },
      ],
    },
    {
      id: "fc-2",
      title: "Help",
      links: [
        { label: "Track Your Order", url: "/track-order" },
        { label: "Order History", url: "/account/orders" },
        { label: "Shipping & Delivery", url: "/shipping" },
        { label: "Returns & Exchanges", url: "/returns" },
        { label: "Frequently Asked Questions", url: "/faq" },
        { label: "Contact Us", url: "/contact" },
      ],
    },
    {
      id: "fc-3",
      title: "Company & Policies",
      links: [
        { label: "About Aadya", url: "/about" },
        { label: "Featured Collections", url: "/collections" },
        { label: "Privacy Policy", url: "/privacy" },
        { label: "Terms of Service", url: "/terms" },
      ],
    },
  ];

  const columns = (footer?.footerColumns?.length ? footer.footerColumns : defaultColumns).filter((c) => c.enabled !== false);

  return (
    <footer className="bg-charcoal text-[#F7F4EF] pt-16 pb-12 border-t border-charcoal/20">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-5">
          {/* Brand Intro Column */}
          <div className="col-span-2 space-y-4">
            <Link to="/" className="font-serif-display text-3xl tracking-tight text-white font-bold inline-block">
              {footer?.footerLogo || branding?.desktopLogo ? (
                <img
                  src={footer?.footerLogo || branding?.desktopLogo}
                  alt={general?.storeName || "Aadya"}
                  className="h-8 object-contain brightness-200"
                />
              ) : (
                general?.storeName || "Aadya"
              )}
            </Link>
            <p className="max-w-sm text-xs sm:text-sm leading-relaxed text-[#FAF6F0]/80">
              {brandDesc}
            </p>
            {footer?.contactDetails !== false && (
              <div className="pt-2 text-xs text-[#FAF6F0]/70 space-y-1.5 font-medium">
                <p className="flex items-center gap-2">
                  <span>📍</span> {address}
                </p>
                {email && (
                  <p className="flex items-center gap-2">
                    <span>✉️</span> {email}
                  </p>
                )}
                {phone && (
                  <p className="flex items-center gap-2">
                    <span>📞</span> {phone}
                  </p>
                )}
              </div>
            )}

            {/* Configured Social Links */}
            {footer?.socialLinksVisibility !== false && socialList.length > 0 && (
              <div className="pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-terracotta-light mb-2">Connect With Us</p>
                <div className="flex flex-wrap gap-3 text-xs text-[#FAF6F0]/80">
                  {socialList.map((s) => (
                    <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer" className="hover:text-white transition underline font-medium">
                      {s.label}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Dynamic Footer Columns */}
          {columns.map((col) => (
            <div key={col.id || col.title}>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-terracotta-light">
                {col.title}
              </h4>
              <ul className="space-y-2.5 text-xs text-[#FAF6F0]/80">
                {col.links?.map((link, idx) => {
                  const to = link.url || (link.type === "CMS_PAGE" ? `/pages/${link.targetId}` : link.type === "CATEGORY" ? `/shop/category/${link.targetId}` : link.type === "COLLECTION" ? `/collections/${link.targetId}` : "#");
                  return (
                    <li key={idx}>
                      <Link to={to} className="hover:text-white transition">
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Payment Icons & Copyright */}
        <div className="mt-14 border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#FAF6F0]/60">
          <p>© {new Date().getFullYear()} {general?.legalName || "Aadya Storefront"}. All rights reserved.</p>
          
          {/* Payment Icons */}
          {footer?.paymentIcons?.length > 0 && (
            <div className="flex items-center gap-2 text-[10px] text-white/70 font-semibold tracking-wider uppercase">
              {footer.paymentIcons.map((icon) => (
                <span key={icon} className="rounded border border-white/15 bg-white/5 px-2 py-0.5">
                  {icon}
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-white transition">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-white transition">Terms of Service</Link>
            <Link to="/shipping" className="hover:text-white transition">Shipping Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

