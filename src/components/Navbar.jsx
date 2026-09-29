import React, { useEffect, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { IconMenu, IconClose, IconCart } from "./icons";
import { useCart } from "../context/CartContext";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { useSiteSettings } from "../hooks/useSiteSettings";
import TopUtilityBar from "./TopUtilityBar";
import SearchModal from "./SearchModal";

import { fetchNavigation, resolveMediaUrl } from "../lib/api";
import BrandLogo from "./BrandLogo";

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

  // Keep the browser tab favicon in sync with the admin-configured branding
  // favicon, falling back to the static /favicon.svg shipped with the app if
  // none is set or the configured one fails to load.
  useEffect(() => {
    const favicon = resolveMediaUrl(branding?.favicon);
    if (!favicon) return;
    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    const previousHref = link.href;
    const testImg = new Image();
    testImg.onload = () => { link.href = favicon; };
    testImg.onerror = () => {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn("[Navbar] configured favicon failed to load, keeping previous favicon.");
      }
      link.href = previousHref;
    };
    testImg.src = favicon;
  }, [branding?.favicon]);

  return (
    <>
      {/* 1. Slim Top Utility Bar */}
      <TopUtilityBar />

      {/* Top Announcement Bar if enabled in site settings */}
      {announcementBar?.active && announcementBar?.text && (
        <div className="store-bg-primary px-4 py-2 text-center text-xs font-medium tracking-wide text-white leading-normal">
          <span>{announcementBar.text}</span>
        </div>
      )}

      {/* 2. Main Header (Bright White). Sticky positioning follows the
          admin-controlled header.stickyHeader setting (default: true) —
          previously a dead setting that Navbar never consumed. */}
      <header
        className={`${header?.stickyHeader !== false ? "sticky top-0 z-40" : "relative"} store-bg transition-all duration-300 ${
          scrolled ? "store-border border-b shadow-sm" : "store-border border-b"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-8 gap-4">
          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-full p-2 store-text hover:bg-black/5 lg:hidden shrink-0"
            aria-label="Open menu"
          >
            <IconMenu className="h-6 w-6" />
          </button>

          {/* Left: Logo — desktop and mobile variants both fall back to the
              store name text if unset or broken. Width comes from the
              admin-controlled logo-width setting; height is only CAPPED
              (max-height), never fixed, so a wide/tall/square logo keeps its
              natural aspect ratio instead of being squashed into a box —
              neither dimension can blow out the header either way. */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline-flex items-center">
              <BrandLogo
                src={branding?.desktopLogo}
                alt={branding?.logoAltText || `${general?.storeName || "Aadya"} Logo`}
                fallbackText={general?.storeName || "Aadya"}
                widthPx={branding?.logoWidthDesktop || 140}
                maxHeightPx={branding?.logoMaxHeightDesktop || 60}
                className="w-auto"
              />
            </span>
            <span className="inline-flex sm:hidden items-center">
              <BrandLogo
                src={branding?.mobileLogo || branding?.desktopLogo}
                alt={branding?.logoAltText || `${general?.storeName || "Aadya"} Logo`}
                fallbackText={general?.storeName || "Aadya"}
                widthPx={branding?.logoWidthMobile || 110}
                maxHeightPx={branding?.logoMaxHeightMobile || 44}
                className="w-auto"
                textClassName="font-serif-display text-xl tracking-tight store-text font-bold"
              />
            </span>
          </Link>

          {/* Center: Large Search Bar */}
          {header?.showSearch !== false && (
            <div className="min-w-0 flex-1 max-w-xl hidden sm:block mx-4">
              <button
                onClick={() => setSearchOpen(true)}
                className="flex w-full items-center gap-3 rounded-full store-border border bg-[var(--theme-surface)] px-4 py-2 text-xs sm:text-sm store-muted transition hover:border-[var(--theme-primary)] hover:store-bg hover:shadow-xs"
              >
                <svg className="h-4 w-4 store-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="truncate store-muted">
                  {header?.searchPlaceholder || "Search home decor, books, gifts and more..."}
                </span>
              </button>
            </div>
          )}

          {/* Right Action Icons: Account, Wishlist, Cart */}
          <div className="flex items-center gap-3 sm:gap-5 shrink-0 store-text">
            {/* Mobile Search Toggle */}
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 store-muted hover:store-text sm:hidden"
              aria-label="Search"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* Account Link */}
            <Link
              to={user ? "/account" : "/login"}
              className="hidden sm:flex items-center gap-1.5 p-1.5 store-text hover:store-primary transition"
              title={user ? "My Account" : "Sign In"}
            >
              <svg className="h-5 w-5 store-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-xs font-semibold uppercase tracking-wider hidden md:inline">
                {user ? "Account" : "Login"}
              </span>
            </Link>

            {/* Wishlist Placeholder */}
            <button
              className="hidden sm:flex items-center gap-1.5 p-1.5 store-text hover:store-primary transition"
              title="Wishlist (Coming Soon)"
            >
              <svg className="h-5 w-5 store-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span className="text-xs font-semibold uppercase tracking-wider hidden md:inline">
                Wishlist
              </span>
            </button>

            {/* Cart Icon + Badge */}
            <button
              onClick={() => setCartDrawerOpen(true)}
              className="relative flex items-center gap-1.5 p-1.5 store-text hover:store-primary transition"
              aria-label="Open cart"
            >
              <div className="relative">
                <IconCart className="h-5 w-5" />
                {count > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full store-bg-primary text-[10px] font-bold text-white shadow">
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
        <div className="hidden lg:block border-t store-border store-bg py-2.5">
          <div className="mx-auto flex max-w-7xl items-center justify-center gap-8 px-8">
            {navItems.map((link) => (
              <NavLink
                key={link.id || link.to}
                to={link.to}
                className={({ isActive }) =>
                  `text-xs font-semibold uppercase tracking-wider transition-colors ${
                    isActive ? "store-primary border-b-2 border-[var(--theme-primary)] pb-0.5" : "store-muted hover:store-primary"
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
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full w-full max-w-xs overflow-y-auto store-bg p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b store-border pb-4">
                <Link to="/" className="font-serif-display text-2xl store-text font-bold">
                  Aadya
                </Link>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-full p-1.5 store-muted hover:bg-black/5"
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
                  className="flex w-full items-center gap-3 rounded-xl store-border border bg-[var(--theme-surface)] p-3 text-left text-sm store-muted"
                >
                  <svg className="h-4 w-4 store-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        isActive ? "store-bg-primary-soft store-primary font-semibold" : "store-text hover:bg-black/5"
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
                          isActive ? "store-bg-primary-soft store-primary font-semibold" : "store-text hover:bg-black/5"
                        }`
                      }
                    >
                      {link.label}
                    </NavLink>
                  ))}
                  <NavLink
                    to={user ? "/account" : "/login"}
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-xl px-4 py-3 text-sm font-medium store-text hover:bg-black/5"
                  >
                    {user ? "My Account" : "Customer Login"}
                  </NavLink>
                  <NavLink
                    to="/track-order"
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-xl px-4 py-3 text-sm font-medium store-text hover:bg-black/5"
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
