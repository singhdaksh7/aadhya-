import React from "react";
import { Link } from "react-router-dom";
import { useSiteSettings } from "../hooks/useSiteSettings";

export default function Footer() {
  const { supportEmail, supportPhone } = useSiteSettings();
  return (
    <footer className="bg-charcoal text-[#F7F4EF] pt-16 pb-12 border-t border-charcoal/20">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-5">
          {/* Brand Intro Column */}
          <div className="col-span-2 space-y-4">
            <Link to="/" className="font-serif-display text-3xl tracking-tight text-white font-bold">
              Aadya
            </Link>
            <p className="max-w-sm text-xs sm:text-sm leading-relaxed text-[#FAF6F0]/80">
              Aadya is a premium Indian home decor and lifestyle brand. We create and curate objects for thoughtful living — celebrating slow craft, natural minerals, and artisan traditions.
            </p>
            <div className="pt-2 text-xs text-[#FAF6F0]/70 space-y-1.5 font-medium">
              <p className="flex items-center gap-2">
                <span>📍</span> Crafted with care in India
              </p>
              {supportEmail && (
                <p className="flex items-center gap-2">
                  <span>✉️</span> {supportEmail}
                </p>
              )}
              {supportPhone && (
                <p className="flex items-center gap-2">
                  <span>📞</span> {supportPhone}
                </p>
              )}
            </div>
          </div>

          {/* Column 1: Shop */}
          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-terracotta-light">
              Shop
            </h4>
            <ul className="space-y-2.5 text-xs text-[#FAF6F0]/80">
              <li><Link to="/shop" className="hover:text-white transition">Home Decor</Link></li>
              <li><Link to="/collections/handcrafted-decor" className="hover:text-white transition">Handcrafted Decor</Link></li>
              <li><Link to="/collections/wellness-decor" className="hover:text-white transition">Wellness Decor</Link></li>
              <li><Link to="/books" className="hover:text-white transition">Books &amp; Monographs</Link></li>
              <li><Link to="/new-arrivals" className="hover:text-white transition">New Arrivals</Link></li>
              <li><Link to="/best-sellers" className="hover:text-white transition">Best Sellers</Link></li>
            </ul>
          </div>

          {/* Column 2: Help & Customer Care */}
          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-terracotta-light">
              Help
            </h4>
            <ul className="space-y-2.5 text-xs text-[#FAF6F0]/80">
              <li><Link to="/track-order" className="hover:text-white transition">Track Your Order</Link></li>
              <li><Link to="/account/orders" className="hover:text-white transition">Order History</Link></li>
              <li><Link to="/shipping" className="hover:text-white transition">Shipping &amp; Delivery</Link></li>
              <li><Link to="/returns" className="hover:text-white transition">Returns &amp; Exchanges</Link></li>
              <li><Link to="/faq" className="hover:text-white transition">Frequently Asked Questions</Link></li>
              <li><Link to="/contact" className="hover:text-white transition">Contact Us</Link></li>
            </ul>
          </div>

          {/* Column 3: Company & Policies */}
          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-terracotta-light">
              Company &amp; Policies
            </h4>
            <ul className="space-y-2.5 text-xs text-[#FAF6F0]/80">
              <li><Link to="/about" className="hover:text-white transition">About Aadya</Link></li>
              <li><Link to="/collections" className="hover:text-white transition">Featured Collections</Link></li>
              <li><Link to="/privacy" className="hover:text-white transition">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-white transition">Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-14 border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#FAF6F0]/60">
          <p>© {new Date().getFullYear()} Aadya Storefront. All rights reserved.</p>
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
