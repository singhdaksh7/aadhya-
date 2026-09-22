import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-charcoal/10 bg-ivory-dark/90 text-charcoal">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-5">
          {/* Brand Intro Column */}
          <div className="col-span-2 space-y-4">
            <Link to="/" className="font-serif-display text-2xl tracking-tight text-charcoal">
              Aadya
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-charcoal-soft">
              Aadya is a premium Indian home decor and lifestyle brand. We create and curate objects for thoughtful living — celebrating slow craft, natural minerals, and artisan traditions.
            </p>
            <div className="pt-2 text-xs text-charcoal-soft space-y-1">
              <p>📍 Crafted with care in India</p>
              <p>✉️ concierge@aadyahome.com</p>
            </div>
          </div>

          {/* Column 1: Shop */}
          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-terracotta">
              Shop Storefront
            </h4>
            <ul className="space-y-2.5 text-xs text-charcoal-soft">
              <li><Link to="/shop" className="hover:text-terracotta">Home Decor</Link></li>
              <li><Link to="/collections/handcrafted-decor" className="hover:text-terracotta">Handcrafted Decor</Link></li>
              <li><Link to="/collections/wellness-decor" className="hover:text-terracotta">Wellness Decor</Link></li>
              <li><Link to="/books" className="hover:text-terracotta">Books &amp; Monographs</Link></li>
              <li><Link to="/new-arrivals" className="hover:text-terracotta">New Arrivals</Link></li>
              <li><Link to="/best-sellers" className="hover:text-terracotta">Best Sellers</Link></li>
            </ul>
          </div>

          {/* Column 2: Customer Care */}
          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-terracotta">
              Customer Care
            </h4>
            <ul className="space-y-2.5 text-xs text-charcoal-soft">
              <li><Link to="/track-order" className="hover:text-terracotta">Track Your Order</Link></li>
              <li><Link to="/account/orders" className="hover:text-terracotta">Order History</Link></li>
              <li><Link to="/shipping" className="hover:text-terracotta">Shipping &amp; Delivery</Link></li>
              <li><Link to="/returns" className="hover:text-terracotta">Returns &amp; Exchanges</Link></li>
              <li><Link to="/faq" className="hover:text-terracotta">Frequently Asked Questions</Link></li>
              <li><Link to="/contact" className="hover:text-terracotta">Contact Us</Link></li>
            </ul>
          </div>

          {/* Column 3: Brand & Legal */}
          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-terracotta">
              Brand &amp; Legal
            </h4>
            <ul className="space-y-2.5 text-xs text-charcoal-soft">
              <li><Link to="/about" className="hover:text-terracotta">About Aadya</Link></li>
              <li><Link to="/collections" className="hover:text-terracotta">Featured Collections</Link></li>
              <li><Link to="/privacy" className="hover:text-terracotta">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-terracotta">Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-14 border-t border-charcoal/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-charcoal-soft">
          <p>© {new Date().getFullYear()} Aadya Storefront. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-charcoal">Privacy</Link>
            <Link to="/terms" className="hover:text-charcoal">Terms</Link>
            <Link to="/shipping" className="hover:text-charcoal">Shipping</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
