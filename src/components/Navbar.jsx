import React, { useEffect, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { IconMenu, IconClose, IconCart } from "./icons";
import { useCart } from "../context/CartContext";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { fetchSiteSettings } from "../lib/api";
import SearchModal from "./SearchModal";

const DEFAULT_ANNOUNCEMENT = "Free delivery above ₹2,499 • Pan-India Express Shipping • Crafted by Master Indian Artisans";

const NAV_LINKS = [
  { to: "/shop", label: "Home Decor" },
  { to: "/collections", label: "Collections" },
  { to: "/books", label: "Books" },
  { to: "/new-arrivals", label: "New Arrivals" },
  { to: "/best-sellers", label: "Best Sellers" },
  { to: "/collections/gifts", label: "Gifts" },
];

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { count, setIsOpen: setCartDrawerOpen } = useCart();
  const location = useLocation();
  const { user } = useCustomerAuth();
  const [announcement, setAnnouncement] = useState(DEFAULT_ANNOUNCEMENT);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    // Settings are optional site dressing — a missing/failed fetch falls
    // back to the default copy rather than showing an empty bar or an error.
    fetchSiteSettings()
      .then((res) => {
        const bar = res.data?.announcementBar;
        if (bar?.active && bar.text) setAnnouncement(bar.text);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <>
      {/* Top Announcement Bar */}
      <div className="bg-charcoal px-4 py-2 text-center text-xs font-medium tracking-wide text-ivory">
        <span>{announcement}</span>
      </div>

      {/* Main Sticky Header */}
      <header
        className={`sticky top-0 z-40 transition-all duration-300 ${
          scrolled ? "border-b border-charcoal/10 bg-ivory/95 shadow-sm backdrop-blur" : "border-b border-charcoal/5 bg-ivory/80 backdrop-blur"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-8">
          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-full p-2 text-charcoal hover:bg-charcoal/5 lg:hidden"
            aria-label="Open menu"
          >
            <IconMenu className="h-6 w-6" />
          </button>

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <span className="font-serif-display text-2xl tracking-tight text-charcoal sm:text-3xl">
              Aadya
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden items-center gap-6 lg:flex">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `text-xs font-semibold uppercase tracking-wider transition-colors ${
                    isActive ? "text-terracotta" : "text-charcoal-soft hover:text-terracotta"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* Right Action Icons & Prominent Search */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Prominent Search Bar / Button */}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 rounded-full border border-charcoal/15 bg-white/80 px-3.5 py-1.5 text-xs text-charcoal-soft transition hover:border-terracotta hover:text-charcoal sm:w-48 lg:w-56"
            >
              <svg className="h-4 w-4 text-charcoal/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="hidden sm:inline truncate">Search home decor...</span>
              <span className="sm:hidden">Search</span>
            </button>

            {/* Account Icon */}
            <Link
              to={user ? "/account" : "/login"}
              className="hidden rounded-full p-2 text-charcoal-soft transition hover:bg-charcoal/5 hover:text-charcoal sm:flex"
              title={user ? "My Account" : "Sign In"}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </Link>

            {/* Cart Icon + Badge */}
            <button
              onClick={() => setCartDrawerOpen(true)}
              className="relative flex items-center justify-center rounded-full p-2 text-charcoal transition hover:bg-charcoal/5"
              aria-label="Open cart"
            >
              <IconCart className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-terracotta text-[10px] font-bold text-ivory shadow">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-charcoal/50 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full w-full max-w-xs overflow-y-auto bg-ivory p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-charcoal/10 pb-4">
                <Link to="/" className="font-serif-display text-2xl text-charcoal">
                  Aadya
                </Link>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-full p-1.5 text-charcoal-soft hover:bg-charcoal/5"
                  aria-label="Close menu"
                >
                  <IconClose className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-6 space-y-4">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setSearchOpen(true);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-charcoal/15 bg-white p-3 text-left text-sm text-charcoal-soft"
                >
                  <svg className="h-4 w-4 text-charcoal/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span>Search objects...</span>
                </button>

                <nav className="flex flex-col space-y-1">
                  <NavLink
                    to="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `rounded-xl px-4 py-3 text-sm font-medium transition ${
                        isActive ? "bg-sage-light text-green-deep font-semibold" : "text-charcoal hover:bg-charcoal/5"
                      }`
                    }
                  >
                    Home
                  </NavLink>
                  {NAV_LINKS.map((link) => (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `rounded-xl px-4 py-3 text-sm font-medium transition ${
                          isActive ? "bg-sage-light text-green-deep font-semibold" : "text-charcoal hover:bg-charcoal/5"
                        }`
                      }
                    >
                      {link.label}
                    </NavLink>
                  ))}
                  <NavLink
                    to={user ? "/account" : "/login"}
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-xl px-4 py-3 text-sm font-medium text-charcoal hover:bg-charcoal/5"
                  >
                    {user ? "My Account" : "Customer Login"}
                  </NavLink>
                  <NavLink
                    to="/track-order"
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-xl px-4 py-3 text-sm font-medium text-charcoal hover:bg-charcoal/5"
                  >
                    Track Order
                  </NavLink>
                </nav>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Live Search Modal */}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
