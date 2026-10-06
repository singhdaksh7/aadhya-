import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { IconMenu, IconClose, IconCart } from "./icons";
import { useCart } from "../context/CartContext";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { useSiteSettings } from "../hooks/useSiteSettings";
import TopUtilityBar from "./TopUtilityBar";
import PromoStrip from "./PromoStrip";
import SearchModal from "./SearchModal";
import BrandLogo from "./BrandLogo";
import PrimaryNav from "./PrimaryNav";
import NavAnchor from "./NavAnchor";
import CircularCategoryNav from "./CircularCategoryNav";
import { fetchNavigation, fetchCategories, resolveMediaUrl } from "../lib/api";
import { normalizeHeaderSettings } from "../lib/headerCmsHelpers";
import { buildNavModel } from "../lib/navModel";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [categories, setCategories] = useState([]);
  const [navigation, setNavigation] = useState([]);
  const [expandedMobileItems, setExpandedMobileItems] = useState({});

  const { count, setIsOpen: setCartDrawerOpen } = useCart();
  const location = useLocation();
  const { user } = useCustomerAuth();
  const { branding, header, shipping, general } = useSiteSettings();

  const cms = normalizeHeaderSettings(header, shipping, general);
  const primaryNavConfig = cms.primaryNav || {};
  const mainHeaderConfig = cms.mainHeader || {};
  const mobileConfig = cms.mobile || {};
  const megaConfig = cms.megaMenu || {};

  // Scroll listener is only needed for the opt-in "scroll" sticky mode.
  useEffect(() => {
    if (cms.stickyMode !== "scroll") {
      setScrolled(false);
      return undefined;
    }
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [cms.stickyMode]);

  // Single data fetch feeding desktop nav, mega menu and mobile drawer.
  useEffect(() => {
    let active = true;
    Promise.all([
      fetchCategories().catch(() => ({ data: [] })),
      fetchNavigation("HEADER_MAIN").catch(() => ({ data: { items: [] } })),
    ]).then(([catRes, navRes]) => {
      if (!active) return;
      const rawCats = Array.isArray(catRes?.data) ? catRes.data : Array.isArray(catRes) ? catRes : [];
      setCategories(rawCats.filter((c) => c.isActive !== false));
      const navItemsList = Array.isArray(navRes?.data?.items) ? navRes.data.items : Array.isArray(navRes?.items) ? navRes.items : [];
      setNavigation(navItemsList);
    });
    return () => {
      active = false;
    };
  }, []);

  const navItems = useMemo(
    () => buildNavModel({ cms, categories, navigation }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [header, shipping, general, categories, navigation]
  );
  const desktopNavItems = navItems.filter((i) => i.showDesktop !== false);
  const mobileNavItems = navItems.filter((i) => i.showMobile !== false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__AADYA_HEADER_RENDERED__ = true;
    }
    return () => {
      if (typeof window !== "undefined") {
        delete window.__AADYA_HEADER_RENDERED__;
      }
    };
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

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
    testImg.onerror = () => { link.href = previousHref; };
    testImg.src = favicon;
  }, [branding?.favicon]);

  const toggleMobileSubmenu = (id) => {
    setExpandedMobileItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Header scrolls away with the page by default ("none"). Sticky is opt-in via the CMS.
  let stickyHeaderClass = "relative";
  if (cms.stickyMode === "always") {
    stickyHeaderClass = "sticky top-0 z-40";
  } else if (cms.stickyMode === "scroll") {
    stickyHeaderClass = scrolled ? "sticky top-0 z-40 shadow-md" : "relative";
  }

  const logoAlignmentClass = mainHeaderConfig.logoAlignment === "left" ? "justify-start" : "justify-center";

  return (
    <>
      {/* 1. Slim Dark Top Utility Bar */}
      <TopUtilityBar />

      {/* 2. Warm Terracotta Announcement / Promo Strip */}
      <PromoStrip />

      {/* 3. Main Header */}
      <header
        className={`${stickyHeaderClass} store-bg store-border border-b`}
      >
        {/* Desktop Header Layout */}
        <div className="hidden lg:grid grid-cols-3 items-center justify-between px-8 py-3.5 max-w-7xl mx-auto gap-4">
          {/* Left Column: Minimalist Search UI */}
          <div className="flex items-center justify-start">
            {mainHeaderConfig.showSearch !== false && (
              <button
                onClick={() => setSearchOpen(true)}
                className="group flex items-center gap-2.5 border-b border-charcoal/20 hover:border-[var(--theme-primary)] focus:border-[var(--theme-primary)] bg-transparent py-1.5 px-0.5 text-xs store-muted transition max-w-[300px] w-full text-left cursor-pointer"
                aria-label="Search products"
              >
                <svg className="h-4 w-4 store-muted group-hover:store-primary transition shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="truncate store-muted group-hover:store-text transition">
                  {mainHeaderConfig.searchPlaceholder || "Search products..."}
                </span>
              </button>
            )}
          </div>

          {/* Center Column: Visually Centered BrandLogo */}
          <div className={`flex items-center ${logoAlignmentClass}`}>
            <Link to="/" className="inline-flex items-center justify-center shrink-0">
              <BrandLogo
                src={branding?.desktopLogo}
                alt={branding?.logoAltText || `${general?.storeName || "Aadya"} Logo`}
                fallbackText={general?.storeName || "Aadya"}
                widthPx={branding?.logoWidthDesktop || 140}
                maxHeightPx={branding?.logoMaxHeightDesktop || 60}
                className="w-auto"
              />
            </Link>
          </div>

          {/* Right Column: Account / Wishlist / Cart */}
          <div className="flex items-center justify-end gap-6 store-text">
            {/* Customer Account */}
            {mainHeaderConfig.showAccount !== false && (
              <Link
                to={user ? "/account" : "/login"}
                className="flex items-center gap-1.5 p-1 store-text hover:store-primary transition group"
                title={user ? "My Account" : "Sign In"}
              >
                <svg className="h-5 w-5 store-text group-hover:store-primary transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  {user ? "Account" : mainHeaderConfig.accountLabel || "Login"}
                </span>
              </Link>
            )}

            {/* Wishlist */}
            {mainHeaderConfig.showWishlist !== false && (
              <Link
                to="/account/wishlist"
                className="flex items-center gap-1.5 p-1 store-text hover:store-primary transition group"
                title="Wishlist"
              >
                <svg className="h-5 w-5 store-text group-hover:store-primary transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Wishlist
                </span>
              </Link>
            )}

            {/* Cart Icon + Badge */}
            {mainHeaderConfig.showCart !== false && (
              <button
                onClick={() => setCartDrawerOpen(true)}
                className="relative flex items-center gap-1.5 p-1 store-text hover:store-primary transition group cursor-pointer"
                aria-label="Open cart"
              >
                <div className="relative">
                  <IconCart className="h-5 w-5 group-hover:store-primary transition" />
                  {mainHeaderConfig.showCartCount !== false && count > 0 && (
                    <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full store-bg-primary text-[10px] font-bold text-white shadow-xs">
                      {count}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Cart
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Header */}
        <div className="flex lg:hidden items-center justify-between px-4 py-3 border-b store-border">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-full p-2 store-text hover:bg-black/5 shrink-0"
            aria-label="Open menu"
          >
            <IconMenu className="h-6 w-6" />
          </button>

          <Link to="/" className="flex items-center shrink-0">
            <BrandLogo
              src={branding?.mobileLogo || branding?.desktopLogo}
              alt={branding?.logoAltText || `${general?.storeName || "Aadya"} Logo`}
              fallbackText={general?.storeName || "Aadya"}
              widthPx={branding?.logoWidthMobile || 110}
              maxHeightPx={branding?.logoMaxHeightMobile || 44}
              className="w-auto"
              textClassName="font-serif-display text-xl tracking-tight store-text font-bold"
            />
          </Link>

          <div className="flex items-center gap-2 shrink-0">
            {mobileConfig.showSearch !== false && (
              <button
                onClick={() => setSearchOpen(true)}
                className="p-2 store-muted hover:store-text"
                aria-label="Search"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            )}
            {mobileConfig.showCart !== false && (
              <button
                onClick={() => setCartDrawerOpen(true)}
                className="relative p-2 store-text hover:store-primary"
                aria-label="Open cart"
              >
                <IconCart className="h-5 w-5" />
                {count > 0 && (
                  <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full store-bg-primary text-[10px] font-bold text-white shadow">
                    {count}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Primary navigation + hover mega menus (desktop). Hero starts directly below. */}
        {primaryNavConfig.enabled !== false && desktopNavItems.length > 0 && (
          <div className="hidden lg:block border-t store-border store-bg">
            <PrimaryNav
              items={desktopNavItems}
              maxColumns={megaConfig.columns || 4}
              menuWidth={megaConfig.dropdownWidth}
              showBadges={primaryNavConfig.showNewBadge !== false}
              resetKey={location.pathname}
            />
          </div>
        )}

        {/* Circular category strip: opt-in only (CMS default is off) */}
        {cms.circularCategories?.enabled === true && <CircularCategoryNav categories={categories} />}

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
                  {mobileConfig.drawerTitle || general?.storeName || "Aadya"}
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
                  <span>{mainHeaderConfig.searchPlaceholder || "Search objects..."}</span>
                </button>

                <nav className="flex flex-col space-y-1">
                  <NavLink
                    to="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                        isActive ? "store-bg-primary-soft store-primary font-semibold" : "store-text hover:bg-black/5"
                      }`
                    }
                  >
                    Home
                  </NavLink>

                  {mobileNavItems.map((link) => {
                    const hasSub = link.hasMenu && mobileConfig.showAccordionChildren !== false;
                    const isExpanded = !!expandedMobileItems[link.id] || (hasSub && mobileConfig.expandCategoriesByDefault === true && expandedMobileItems[link.id] === undefined);
                    const panelId = `mobile-submenu-${link.id}`;

                    return (
                      <div key={link.id} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <NavAnchor
                            to={link.to}
                            external={link.external}
                            openInNewTab={link.openInNewTab}
                            onClick={() => setMobileMenuOpen(false)}
                            className={({ isActive } = {}) =>
                              `flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                                isActive ? "store-bg-primary-soft store-primary font-semibold" : "store-text hover:bg-black/5"
                              }`
                            }
                          >
                            {link.label}
                          </NavAnchor>

                          {hasSub && (
                            <button
                              type="button"
                              onClick={() => toggleMobileSubmenu(link.id)}
                              className="p-2 store-muted hover:store-text"
                              aria-label={`Toggle ${link.label} menu`}
                              aria-expanded={isExpanded}
                              aria-controls={panelId}
                            >
                              <svg
                                className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                aria-hidden="true"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          )}
                        </div>

                        {/* Mobile accordion submenu (same normalized data as desktop mega menu) */}
                        {hasSub && isExpanded && (
                          <div id={panelId} className="pl-6 space-y-2 border-l-2 border-[var(--theme-primary)]/20 ml-4 py-1">
                            {link.columns.map((col) => (
                              <div key={col.id} className="space-y-1">
                                {col.title && (
                                  <p className="px-3 pt-1 text-[10px] font-bold uppercase tracking-widest store-primary">
                                    {col.title}
                                  </p>
                                )}
                                {col.links.map((sub) => (
                                  <NavAnchor
                                    key={sub.id}
                                    to={sub.to}
                                    external={sub.external}
                                    openInNewTab={sub.openInNewTab}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="block py-1.5 px-3 text-xs store-muted hover:store-primary transition font-medium"
                                  >
                                    {sub.label}
                                  </NavAnchor>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {mobileConfig.showAccount !== false && (
                    <NavLink
                      to={user ? "/account" : "/login"}
                      onClick={() => setMobileMenuOpen(false)}
                      className="rounded-xl px-4 py-2.5 text-sm font-medium store-text hover:bg-black/5"
                    >
                      {user ? "My Account" : "Customer Login"}
                    </NavLink>
                  )}
                  <NavLink
                    to="/track-order"
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-xl px-4 py-2.5 text-sm font-medium store-text hover:bg-black/5"
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
