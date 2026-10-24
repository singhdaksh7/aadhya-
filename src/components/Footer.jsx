import React from "react";
import { Link } from "react-router-dom";
import { useSiteSettings } from "../hooks/useSiteSettings";
import BrandLogo from "./BrandLogo";
import { SITE_CREDIT } from "../lib/siteCredit";
import { isExternalUrl } from "../lib/footerUrls";
import { CompanyBlock, ContactItems, SeoBand, PaymentBadges, FooterImage, hasPaymentBadgeImages } from "./FooterSections";

export default function Footer() {
  const { footer, general, social, branding, supportEmail, supportPhone } = useSiteSettings();

  const brandDesc = footer?.brandDescription || general?.shortDescription || "";
  const email = general?.supportEmail || supportEmail || "";
  const phone = general?.supportPhone || supportPhone || "";
  const addressParts = [
    general?.businessAddress,
    general?.businessAddressLine2,
    general?.city,
    general?.state,
    general?.postalCode,
    general?.country,
  ].filter((part) => Boolean(part && String(part).trim()));
  const address = addressParts.join(", ");
  const socialHeading = footer?.socialHeading || "Connect With Us";

  // Social links filter
  const socialList = [
    { key: "instagram", label: "Instagram", url: social?.instagram },
    { key: "facebook", label: "Facebook", url: social?.facebook },
    { key: "youtube", label: "YouTube", url: social?.youtube },
    { key: "pinterest", label: "Pinterest", url: social?.pinterest },
    { key: "linkedin", label: "LinkedIn", url: social?.linkedin },
    { key: "twitter", label: "X/Twitter", url: social?.twitter },
    { key: "whatsapp", label: "WhatsApp", url: social?.whatsapp || (general?.whatsappNumber ? `https://wa.me/${general.whatsappNumber.replace(/[^\d]/g, "")}` : "") },
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
        { label: "About Tushaqsa", url: "/about" },
        { label: "Featured Collections", url: "/collections" },
        { label: "Privacy Policy", url: "/privacy" },
        { label: "Terms & Conditions", url: "/terms" },
      ],
    },
  ];

  const columns = (footer?.footerColumns?.length ? footer.footerColumns : defaultColumns).filter((c) => c.enabled !== false);

  const hasBadges = hasPaymentBadgeImages(footer?.paymentBadges);
  // Up to 8 columns: the classic 3-column layout is unchanged; more columns wrap in a 4/6-track grid.
  const gridCls = columns.length > 3 ? "grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4 lg:grid-cols-6" : "grid grid-cols-2 gap-10 md:grid-cols-5";

  return (
    <footer className="bg-charcoal text-[#F7F4EF] pt-16 pb-12 border-t border-charcoal/20">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <FooterImage config={footer?.image} placement="TOP" />
        <div className={gridCls}>
          {/* Brand Intro Column */}
          <div className="col-span-2 min-w-0 space-y-4">
            <Link to="/" className="inline-block">
              <BrandLogo
                src={footer?.footerLogo || branding?.desktopLogo}
                alt={general?.storeName || "Tushaqsa"}
                fallbackText={general?.storeName || "Tushaqsa"}
                className="h-8 object-contain brightness-200"
                textClassName="font-serif-display text-3xl tracking-tight text-white font-bold"
              />
            </Link>
            <p className="max-w-sm text-xs sm:text-sm leading-relaxed text-[#FAF6F0]/80">
              {brandDesc}
            </p>
            <CompanyBlock block={footer?.companyBlock} />
            {footer?.contactDetails !== false && (address || email || phone) && (
              <div className="pt-2 text-xs text-[#FAF6F0]/70 space-y-1.5 font-medium">
                {address && (
                  <p className="flex items-center gap-2">
                    <span>📍</span> {address}
                  </p>
                )}
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

            <ContactItems items={footer?.contactItems} />
            <FooterImage config={footer?.image} placement="BRAND" />

            {/* Configured Social Links */}
            {footer?.socialLinksVisibility !== false && socialList.length > 0 && (
              <div className="pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest store-accent mb-2">{socialHeading}</p>
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
            <div key={col.id || col.title} className="min-w-0 break-words">
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest store-accent">
                {col.title}
              </h4>
              <ul className="space-y-2.5 text-xs text-[#FAF6F0]/80">
                {col.links?.map((link, idx) => {
                  const to = link.url || (link.type === "CMS_PAGE" ? `/pages/${link.targetId}` : link.type === "CATEGORY" ? `/shop/category/${link.targetId}` : link.type === "COLLECTION" ? `/collections/${link.targetId}` : "#");
                  return (
                    <li key={idx}>
                      {isExternalUrl(to) ? (
                        <a href={to} target="_blank" rel="noopener noreferrer" className="hover:text-white transition">
                          {link.label}
                        </a>
                      ) : (
                        <Link to={to} className="hover:text-white transition">
                          {link.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <SeoBand sections={footer?.seoSections} />
        <FooterImage config={footer?.image} placement="BOTTOM" />

        {/* Payment Icons & Copyright */}
        <div className="mt-14 border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#FAF6F0]/60">
          <p>© {new Date().getFullYear()} {general?.legalName || general?.storeName || "Tushaqsa"}. All rights reserved.</p>
          
          {/* Payment Icons */}
          {hasBadges && <PaymentBadges badges={footer.paymentBadges} />}
          {!hasBadges && footer?.paymentIcons?.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-white/70 font-semibold tracking-wider uppercase">
              {footer.paymentIcons.map((icon) => (
                <span key={icon} className="rounded border border-white/15 bg-white/5 px-2 py-0.5">
                  {icon}
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-white transition">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-white transition">Terms &amp; Conditions</Link>
            <Link to="/shipping" className="hover:text-white transition">Shipping Policy</Link>
          </div>
        </div>
        {/* Developer credit: fixed in code (src/lib/siteCredit.js), not managed from Admin. */}
        <p data-testid="footer-credit" className="mt-5 text-center text-[11px] text-[#FAF6F0]/50">
          © Copyright {new Date().getFullYear()}. All Rights Reserved. Made with ❤️ by <span className="font-semibold text-[#FAF6F0]/80">{SITE_CREDIT.team}</span>
        </p>
      </div>
    </footer>
  );
}

