import React, { useEffect, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { IconMenu, IconClose, IconCart } from "./icons";
import { useCart } from "../context/CartContext";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { useSiteSettings } from "../hooks/useSiteSettings";
import TopUtilityBar from "./TopUtilityBar";
import SearchModal from "./SearchModal";

import { fetchNavigation } from "../lib/api";

const DEFAULT_NAV_LINKS = [
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
  const [navItems, setNavItems] = useState(DEFAULT_NAV_LINKS);
  const { count, setIsOpen: setCartDrawerOpen } = useCart();
  const location = useLocation();
  const { user } = useCustomerAuth();
  const { announcementBar, branding, header, general } = useSiteSettings();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let active = true;
    fetchNavigation("HEADER_MAIN")
      .then((res) => {
        if (!active) return;
        if (res.data?.items?.length > 0) {
          const mapped = res.data.items.map((item) => ({
            id: item.id,
            to: item.url || (item.type === "CATEGORY" ? `/shop/category/${item.targetId}` : item.type === "COLLECTION" ? `/collections/${item.targetId}` : "#"),
            label: item.title,
            children: item.children || [],
          }));
          setNavItems(mapped);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <>
      {/* 1. Slim Top Utility Bar */}
      <TopUtilityBar />

      {/* Top Announcement Bar if enabled in site settings */}
      {announcementBar?.active && announcementBar?.text && (
        <div className="bg-charcoal px-4 py-2 text-center text-xs font-medium tracking-wide text-white leading-normal">
          <span>{announcementBar.text}</span>
        </div>
      )}

      {/* 2. Main Header (Bright White) */}
      <header
        className={`sticky top-0 z-40 bg-white transition-all duration-300 ${
          scrolled ? "border-b border-charcoal/10 shadow-sm" : "border-b border-charcoal/10"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-8 gap-4">
          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-full p-2 text-charcoal hover:bg-charcoal/5 lg:hidden shrink-0"
            aria-label="Open menu"
          >
            <IconMenu className="h-6 w-6" />
          </button>

          {/* Left: Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            {branding?.desktopLogo ? (
              <img
                src={branding.desktopLogo}
                alt={branding.logoAltText || "Aadya Logo"}
                style={{ width: branding.logoWidthDesktop ? `${branding.logoWidthDesktop}px` : "auto" }}
                className="h-8 object-contain"
              />
            ) : (
              <span className="font-serif-display text-2xl tracking-tight text-charcoal sm:text-3xl font-bold">
                {general?.storeName || "Aadya"}
              </span>
            )}
          </Link>

          {/* Center: Large Search Bar */}
          {header?.showSearch !== false && (
            <div className="flex-1 max-w-xl hidden sm:block mx-4">
              <button
                onClick={() => setSearchOpen(true)}
                className="flex w-full items-center gap-3 rounded-full border border-charcoal/20 bg-[#FAF6F0] px-4 py-2 text-xs sm:text-sm text-charcoal-soft transition hover:border-terracotta hover:bg-white hover:shadow-xs"
              >
                <svg className="h-4 w-4 text-charcoal/50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="truncate text-charcoal/70">
                  {header?.searchPlaceholder || "Search home decor, books, gifts and more..."}
                </span>
              </button>
            </div>
          )}

          {/* Right Action Icons: Account, Wishlist, Cart */}
          <div className="flex items-center gap-3 sm:gap-5 shrink-0 text-charcoal">
            {/* Mobile Search Toggle */}
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 text-charcoal-soft hover:text-charcoal sm:hidden"
              aria-label="Search"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* Account Link */}
            <Link
              to={user ? "/account" : "/login"}
              className="hidden sm:flex items-center gap-1.5 p-1.5 text-charcoal hover:text-terracotta transition"
              title={user ? "My Account" : "Sign In"}
            >
              <svg className="h-5 w-5 text-charcoal/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-xs font-semibold uppercase tracking-wider hidden md:inline">
                {user ? "Account" : "Login"}
              </span>
            </Link>

            {/* Wishlist Placeholder */}
            <button
              className="hidden sm:flex items-center gap-1.5 p-1.5 text-charcoal hover:text-terracotta transition"
              title="Wishlist (Coming Soon)"
            >
              <svg className="h-5 w-5 text-charcoal/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span className="text-xs font-semibold uppercase tracking-wider hidden md:inline">
                Wishlist
              </span>
            </button>

            {/* Cart Icon + Badge */}
            <button
              onClick={() => setCartDrawerOpen(true)}
              className="relative flex items-center gap-1.5 p-1.5 text-charcoal hover:text-terracotta transition"
              aria-label="Open cart"
            >
              <div className="relative">
                <IconCart className="h-5 w-5" />
                {count > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-terracotta text-[10px] font-bold text-white shadow">
                    {count}
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider hidden md:inline">
                Cart
              </span>
            </button>
          </div>
        </div>

        {/* Desktop Retail Sub-Navigation Bar */}
        <div className="hidden lg:block border-t border-charcoal/5 bg-white py-2.5">
          <div className="mx-auto flex max-w-7xl items-center justify-center gap-8 px-8">
            {navItems.map((link) => (
              <NavLink
                key={link.id || link.to}
                to={link.to}
                className={({ isActive }) =>
                  `text-xs font-semibold uppercase tracking-wider transition-colors ${
                    isActive ? "text-terracotta border-b-2 border-terracotta pb-0.5" : "text-charcoal-soft hover:text-terracotta"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-charcoal/50 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full w-full max-w-xs overflow-y-auto bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-charcoal/10 pb-4">
                <Link to="/" className="font-serif-display text-2xl text-charcoal font-bold">
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
                  className="flex w-full items-center gap-3 rounded-xl border border-charcoal/15 bg-[#FAF6F0] p-3 text-left text-sm text-charcoal-soft"
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
                        isActive ? "bg-terracotta/10 text-terracotta font-semibold" : "text-charcoal hover:bg-charcoal/5"
                      }`
                    }
                  >
                    Home
                  </NavLink>
                  {navItems.map((link) => (
                    <NavLink
                      key={link.id || link.to}
                      to={link.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `rounded-xl px-4 py-3 text-sm font-medium transition ${
                          isActive ? "bg-terracotta/10 text-terracotta font-semibold" : "text-charcoal hover:bg-charcoal/5"
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
