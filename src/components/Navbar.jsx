import React, { useEffect, useState, useRef } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { IconMenu, IconClose, IconCart } from "./icons";
import { useCart } from "../context/CartContext";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { useSiteSettings } from "../hooks/useSiteSettings";
import TopUtilityBar from "./TopUtilityBar";
import PromoStrip from "./PromoStrip";
import SearchModal from "./SearchModal";
import BrandLogo from "./BrandLogo";
import MegaMenu from "./MegaMenu";
import CircularCategoryNav from "./CircularCategoryNav";
import { fetchNavigation, fetchCategories, resolveMediaUrl } from "../lib/api";
import { normalizeHeaderSettings } from "../lib/headerCmsHelpers";

const DEFAULT_NAV_LINKS = [
  { id: "nav-new", to: "/new-arrivals", label: "New", isNewBadge: true },
  { id: "nav-home-decor", to: "/shop/category/home-decor", label: "Home Decor" },
  { id: "nav-ceramics", to: "/shop/category/ceramics", label: "Ceramics" },
  { id: "nav-textiles", to: "/shop/category/textiles", label: "Linen & Textiles" },
  { id: "nav-lighting", to: "/shop/category/lighting", label: "Lamps & Lighting" },
  { id: "nav-books", to: "/books", label: "Books" },
  { id: "nav-gifts", to: "/collections/gifts", label: "Gifts" },
];

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [navItems, setNavItems] = useState(DEFAULT_NAV_LINKS);
  const [categories, setCategories] = useState([]);
  const [activeMegaMenu, setActiveMegaMenu] = useState(null);
  const [expandedMobileItems, setExpandedMobileItems] = useState({});

  const hoverTimeoutRef = useRef(null);
  const { count, setIsOpen: setCartDrawerOpen } = useCart();
  const location = useLocation();
  const { user } = useCustomerAuth();
  const { branding, header, shipping, general } = useSiteSettings();

  const cms = normalizeHeaderSettings(header, shipping, general);
  const primaryNavConfig = cms.primaryNav || {};
  const mainHeaderConfig = cms.mainHeader || {};
  const mobileConfig = cms.mobile || {};

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchCategories().catch(() => ({ data: [] })),
      fetchNavigation("HEADER_MAIN").catch(() => ({ data: { items: [] } })),
    ]).then(([catRes, navRes]) => {
      if (!active) return;
      const rawCats = Array.isArray(catRes?.data) ? catRes.data : (Array.isArray(catRes) ? catRes : []);
      const activeCats = rawCats.filter((c) => c.isActive !== false);
      setCategories(activeCats);

      // Manual nav items configured in Header CMS take precedence if primaryNav.mode === "MANUAL"
      if (primaryNavConfig.mode === "MANUAL" && Array.isArray(primaryNavConfig.items) && primaryNavConfig.items.length > 0) {
        const mappedManual = primaryNavConfig.items
          .filter((i) => i.enabled !== false)
          .map((item, idx) => ({
            id: item.id || `manual-nav-${idx}`,
            to: item.destination || "#",
            label: item.label,
            name: item.label,
            badge: item.badge,
            badgeStyle: item.badgeStyle,
            openInNewTab: item.openInNewTab,
            enableMegaMenu: item.enableMegaMenu !== false,
            children: [],
          }));
        setNavItems(mappedManual);
        return;
      }

      // Build hierarchy map from active categories for AUTO mode
      const categoryMap = new Map();
      activeCats.forEach((cat) => {
        categoryMap.set(cat.id, {
          id: cat.id,
          to: `/shop/category/${cat.slug}`,
          label: cat.name,
          name: cat.name,
          slug: cat.slug,
          image: cat.image || cat.desktopBanner,
          description: cat.description,
          children: [],
        });
      });

      const rootCategories = [];
      activeCats.forEach((cat) => {
        if (cat.parentId && categoryMap.has(cat.parentId)) {
          categoryMap.get(cat.parentId).children.push(categoryMap.get(cat.id));
        } else if (!cat.parentId) {
          rootCategories.push(categoryMap.get(cat.id));
        }
      });

      const navItemsList = Array.isArray(navRes?.data?.items) ? navRes.data.items : (Array.isArray(navRes?.items) ? navRes.items : []);
      if (navItemsList.length > 0) {
        const mappedNav = navItemsList.map((item) => {
          const catMatch = activeCats.find((c) => c.id === item.targetId || c.slug === item.targetId);
          return {
            id: item.id,
            to: item.url || (item.type === "CATEGORY" ? `/shop/category/${item.targetId}` : item.type === "COLLECTION" ? `/collections/${item.targetId}` : "#"),
            label: item.title,
            name: item.title,
            image: catMatch?.image || catMatch?.desktopBanner,
            description: catMatch?.description,
            children: item.children?.length > 0 ? item.children : (catMatch ? categoryMap.get(catMatch.id)?.children || [] : []),
          };
        });
        setNavItems(mappedNav);
      } else if (rootCategories.length > 0) {
        const navList = [
          { id: "nav-new-top", to: "/new-arrivals", label: "New", isNewBadge: true },
          ...rootCategories.map((c) => ({
            id: c.id,
            to: `/shop/category/${c.slug}`,
            label: c.name,
            name: c.name,
            slug: c.slug,
            image: c.image,
            description: c.description,
            children: c.children,
          })),
          { id: "nav-books-top", to: "/books", label: "Books" },
          { id: "nav-gifts-top", to: "/collections/gifts", label: "Gifts" },
        ];
        setNavItems(navList);
      }
    });

    return () => { active = false; };
  }, [primaryNavConfig.mode, JSON.stringify(primaryNavConfig.items)]);

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
    setActiveMegaMenu(null);
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

  const handleMouseEnter = (link) => {
    if (primaryNavConfig.enableMegaMenu === false) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (link.children && link.children.length > 0) {
      setActiveMegaMenu(link);
    } else {
      setActiveMegaMenu(null);
    }
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setActiveMegaMenu(null);
    }, 150);
  };

  const toggleMobileSubmenu = (id) => {
    setExpandedMobileItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Sticky class calculations
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
        className={`${stickyHeaderClass} store-bg transition-all duration-300 ${
          scrolled ? "store-border border-b shadow-sm" : "store-border border-b"
        }`}
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

        {/* 6. Primary Navigation Row (Desktop) */}
        {primaryNavConfig.enabled !== false && (
          <div className="hidden lg:block border-t store-border store-bg relative">
            <div
              className="mx-auto flex max-w-7xl items-center justify-center gap-8 px-8 py-2.5"
              onMouseLeave={handleMouseLeave}
            >
              {navItems.map((link, idx) => {
                const hasSub = link.children && link.children.length > 0;
                const isNew = (primaryNavConfig.showNewBadge !== false && (link.isNewBadge || link.badge === "NEW" || idx === 0));

                return (
                  <div
                    key={link.id || link.to || idx}
                    className="relative group py-1"
                    onMouseEnter={() => handleMouseEnter(link)}
                  >
                    <NavLink
                      to={link.to}
                      target={link.openInNewTab ? "_blank" : undefined}
                      rel={link.openInNewTab ? "noopener noreferrer" : undefined}
                      className={({ isActive }) =>
                        `inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors ${
                          isActive || (activeMegaMenu?.id === link.id)
                            ? "store-primary border-b-2 border-[var(--theme-primary)] pb-0.5"
                            : "store-muted hover:store-primary"
                        }`
                      }
                    >
                      <span>{link.label}</span>
                      {isNew && (
                        <span className="store-bg-primary text-white text-[8px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                          {link.badge || "NEW"}
                        </span>
                      )}
                      {hasSub && primaryNavConfig.enableMegaMenu !== false && (
                        <svg className="h-3 w-3 opacity-60 group-hover:opacity-100 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </NavLink>
                  </div>
                );
              })}
            </div>

            {/* 7. Dynamic Mega Menu Component */}
            {activeMegaMenu && primaryNavConfig.enableMegaMenu !== false && (
              <div
                onMouseEnter={() => {
                  if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                }}
                onMouseLeave={handleMouseLeave}
              >
                <MegaMenu
                  item={activeMegaMenu}
                  isOpen={!!activeMegaMenu}
                  onClose={() => setActiveMegaMenu(null)}
                />
              </div>
            )}
          </div>
        )}

        {/* 8. Circular Category Navigation Scroller */}
        <CircularCategoryNav categories={categories} />

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

                  {navItems.map((link) => {
                    const hasSub = link.children && link.children.length > 0;
                    const isExpanded = !!expandedMobileItems[link.id];

                    return (
                      <div key={link.id || link.to} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <NavLink
                            to={link.to}
                            onClick={() => setMobileMenuOpen(false)}
                            className={({ isActive }) =>
                              `flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                                isActive ? "store-bg-primary-soft store-primary font-semibold" : "store-text hover:bg-black/5"
                              }`
                            }
                          >
                            {link.label}
                          </NavLink>

                          {hasSub && (
                            <button
                              onClick={() => toggleMobileSubmenu(link.id)}
                              className="p-2 store-muted hover:store-text"
                              aria-label="Toggle subcategories"
                            >
                              <svg
                                className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          )}
                        </div>

                        {/* Mobile Accordion Submenu */}
                        {hasSub && (mobileConfig.showAccordionChildren !== false) && isExpanded && (
                          <div className="pl-6 space-y-1 border-l-2 border-[var(--theme-primary)]/20 ml-4 py-1">
                            {link.children.map((sub, sIdx) => {
                              const subUrl = sub.url || (sub.slug ? `/shop/category/${sub.slug}` : sub.to || "#");
                              return (
                                <NavLink
                                  key={sub.id || sIdx}
                                  to={subUrl}
                                  onClick={() => setMobileMenuOpen(false)}
                                  className="block py-1.5 px-3 text-xs store-muted hover:store-primary transition font-medium"
                                >
                                  {sub.name || sub.title || sub.label}
                                </NavLink>
                              );
                            })}
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
