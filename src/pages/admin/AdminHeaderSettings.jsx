import React, { useEffect, useState } from "react";
import {
  adminFetchSiteSettings,
  adminUpdateSiteSettings,
  adminListCategories,
} from "../../lib/api";
import { Button } from "../../components/ui";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";
import ImagePickerInput from "../../components/admin/ImagePickerInput";
import { applyThemeVariables, refreshSiteSettings } from "../../hooks/useSiteSettings";
import { DEFAULT_HEADER_CMS_SETTINGS, normalizeHeaderSettings } from "../../lib/headerCmsHelpers";
import TopUtilityBar from "../../components/TopUtilityBar";
import PromoStrip from "../../components/PromoStrip";
import CircularCategoryNav from "../../components/CircularCategoryNav";
import PrimaryNav from "../../components/PrimaryNav";
import NavItemEditor from "../../components/admin/NavItemEditor";
import { buildNavModel } from "../../lib/navModel";
import BrandLogo from "../../components/BrandLogo";

export default function AdminHeaderSettings() {
  const [activeTab, setActiveTab] = useState("general");
  const [status, setStatus] = useState("loading");
  const [fullSettings, setFullSettings] = useState({});
  const [headerCms, setHeaderCms] = useState(DEFAULT_HEADER_CMS_SETTINGS);
  const [initialHeaderCms, setInitialHeaderCms] = useState(DEFAULT_HEADER_CMS_SETTINGS);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewViewport, setPreviewViewport] = useState("desktop"); // "desktop" | "mobile"
  const [previewMenuId, setPreviewMenuId] = useState("");

  useEffect(() => {
    Promise.all([
      adminFetchSiteSettings(),
      adminListCategories(true).catch(() => ({ data: [] })),
    ])
      .then(([settingsRes, catRes]) => {
        const rawSettings = settingsRes.data || {};
        setFullSettings(rawSettings);

        const normalized = normalizeHeaderSettings(
          rawSettings.header,
          rawSettings.shipping,
          rawSettings.general
        );
        setHeaderCms(normalized);
        setInitialHeaderCms(JSON.parse(JSON.stringify(normalized)));

        const catData = Array.isArray(catRes.data) ? catRes.data : (Array.isArray(catRes.items) ? catRes.items : []);
        setCategories(catData.filter((c) => c.isActive !== false));
        setStatus("ready");
      })
      .catch((err) => {
        setError(err.message || "Failed to load Header CMS settings.");
        setStatus("error");
      });
  }, []);

  const isDirty = JSON.stringify(headerCms) !== JSON.stringify(initialHeaderCms);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);

    try {
      const payload = {
        ...fullSettings,
        header: headerCms,
      };

      const res = await adminUpdateSiteSettings(payload);
      if (res.data) {
        setFullSettings(res.data);
        const freshNormalized = normalizeHeaderSettings(
          res.data.header,
          res.data.shipping,
          res.data.general
        );
        setHeaderCms(freshNormalized);
        setInitialHeaderCms(JSON.parse(JSON.stringify(freshNormalized)));
        if (res.data.appearance) {
          applyThemeVariables(res.data.appearance);
        }
      }
      await refreshSiteSettings();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message || "Could not save Header CMS settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetUnsaved = () => {
    setHeaderCms(JSON.parse(JSON.stringify(initialHeaderCms)));
  };

  const handleResetDefaults = () => {
    if (window.confirm("Reset all Header CMS settings to Aadya defaults?")) {
      setHeaderCms(JSON.parse(JSON.stringify(DEFAULT_HEADER_CMS_SETTINGS)));
    }
  };

  if (status === "loading") return <LoadingNotice label="Loading Header CMS configuration…" />;
  if (status === "error") return <ErrorNotice message={error || "Unable to load settings."} />;

  // Utility bar item handlers
  const handleAddUtilityItem = () => {
    const newItem = {
      id: `ub-${Date.now()}`,
      enabled: true,
      label: "New Utility Announcement",
      icon: "truck",
      linkType: "internal",
      url: "/shipping",
      openInNewTab: false,
      showDesktop: true,
      showMobile: true,
      sortOrder: (headerCms.utilityBar.items?.length || 0) + 1,
    };
    setHeaderCms((prev) => ({
      ...prev,
      utilityBar: {
        ...prev.utilityBar,
        items: [...(prev.utilityBar.items || []), newItem],
      },
    }));
  };

  const handleUpdateUtilityItem = (index, updates) => {
    setHeaderCms((prev) => {
      const items = [...(prev.utilityBar.items || [])];
      items[index] = { ...items[index], ...updates };
      return {
        ...prev,
        utilityBar: { ...prev.utilityBar, items },
      };
    });
  };

  const handleDeleteUtilityItem = (index) => {
    setHeaderCms((prev) => {
      const items = [...(prev.utilityBar.items || [])];
      items.splice(index, 1);
      return {
        ...prev,
        utilityBar: { ...prev.utilityBar, items },
      };
    });
  };

  const handleMoveUtilityItem = (index, direction) => {
    setHeaderCms((prev) => {
      const items = [...(prev.utilityBar.items || [])];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= items.length) return prev;
      const temp = items[index];
      items[index] = items[targetIndex];
      items[targetIndex] = temp;
      return {
        ...prev,
        utilityBar: { ...prev.utilityBar, items },
      };
    });
  };

  // Primary Nav manual item handlers
  const handleAddNavItem = () => {
    const newItem = {
      id: `nav-manual-${Date.now()}`,
      label: "New Collection",
      enabled: true,
      destinationType: "CATEGORY",
      destination: "/shop",
      categoryId: "",
      categorySlug: "",
      megaMenuMode: "AUTO_FROM_CATEGORY",
      manualColumns: [],
      promoCard: { enabled: false },
      sortOrder: (headerCms.primaryNav.items?.length || 0) + 1,
      showDesktop: true,
      showMobile: true,
      badge: "",
      badgeStyle: "primary",
      openInNewTab: false,
      enableMegaMenu: true,
    };
    setHeaderCms((prev) => ({
      ...prev,
      primaryNav: {
        ...prev.primaryNav,
        items: [...(prev.primaryNav.items || []), newItem],
      },
    }));
  };

  const handleUpdateNavItem = (index, updates) => {
    setHeaderCms((prev) => {
      const items = [...(prev.primaryNav.items || [])];
      items[index] = { ...items[index], ...updates };
      return {
        ...prev,
        primaryNav: { ...prev.primaryNav, items },
      };
    });
  };

  const handleDeleteNavItem = (index) => {
    setHeaderCms((prev) => {
      const items = [...(prev.primaryNav.items || [])];
      items.splice(index, 1);
      return {
        ...prev,
        primaryNav: { ...prev.primaryNav, items },
      };
    });
  };

  const handleMoveNavItem = (index, direction) => {
    setHeaderCms((prev) => {
      const items = [...(prev.primaryNav.items || [])];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= items.length) return prev;
      const temp = items[index];
      items[index] = items[targetIndex];
      items[targetIndex] = temp;
      return {
        ...prev,
        primaryNav: { ...prev.primaryNav, items },
      };
    });
  };

  const previewNavItems = buildNavModel({ cms: headerCms, categories }).filter((i) => i.showDesktop !== false);
  const previewMenuItems = previewNavItems.filter((i) => i.hasMenu);

  const tabs = [
    { id: "general", label: "General Header" },
    { id: "utilityBar", label: "Utility Bar" },
    { id: "promoTicker", label: "Announcement Ticker" },
    { id: "mainHeader", label: "Main Header" },
    { id: "primaryNav", label: "Primary Navigation" },
    { id: "megaMenu", label: "Mega Menu" },
    { id: "circularCategories", label: "Circular Categories" },
    { id: "mobile", label: "Mobile Navigation" },
    { id: "preview", label: "Live Preview" },
  ];

  return (
    <div className="space-y-6 max-w-6xl pb-16">
      {/* Header & Action Toolbar */}
      <div className="admin-page-header flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="admin-page-header__eyebrow">Storefront Content</p>
          <h1 className="admin-page-header__title">Header &amp; Navigation CMS</h1>
          <p className="admin-page-header__desc">
            Make storefront header elements, tickers, menus, and category bars fully admin-driven.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {isDirty && (
            <Button onClick={handleResetUnsaved} className="bg-stone-200 text-stone-800 hover:bg-stone-300 text-xs">
              Reset Unsaved
            </Button>
          )}
          <Button onClick={handleResetDefaults} className="bg-stone-100 text-stone-600 hover:bg-stone-200 text-xs">
            Defaults
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-terracotta text-white disabled:opacity-60 text-xs font-semibold px-5">
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>

      {isDirty && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900 flex items-center justify-between">
          <span>⚠️ You have unsaved changes to the Header configuration.</span>
          <span className="text-[11px] font-mono text-amber-700">Modified</span>
        </div>
      )}

      {saved && (
        <div className="rounded-xl bg-sage-light px-4 py-3 text-xs font-semibold text-green-deep animate-fade-up">
          ✓ Header &amp; Navigation CMS settings successfully saved and applied live!
        </div>
      )}
      {error && <p className="text-xs font-semibold text-terracotta">{error}</p>}

      {/* Tabs list */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar border-b border-charcoal/10 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
              activeTab === tab.id
                ? "bg-charcoal text-white shadow-xs"
                : "text-charcoal-soft hover:bg-charcoal/5 hover:text-charcoal"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: General Header Settings */}
      {activeTab === "general" && (
        <div className="space-y-5 rounded-2xl border border-charcoal/10 bg-white p-6 shadow-xs">
          <h3 className="text-sm font-bold text-charcoal uppercase tracking-wider border-b border-charcoal/10 pb-2">
            1. General Header Settings
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-charcoal">Header Sticky Behavior</label>
              <select
                value={headerCms.stickyMode}
                onChange={(e) => setHeaderCms({ ...headerCms, stickyMode: e.target.value })}
                className="w-full rounded-xl border border-charcoal/20 p-2.5 text-xs focus:border-terracotta focus:outline-none"
              >
                <option value="always">Always Sticky (Stays fixed at top)</option>
                <option value="scroll">Sticky after scrolling down</option>
                <option value="none">Not Sticky (Normal document flow)</option>
              </select>
              <p className="text-[11px] text-charcoal-soft">Controls whether header sticks on scroll.</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-charcoal font-sans">Header Background Mode</label>
              <select
                value={headerCms.backgroundMode}
                onChange={(e) => setHeaderCms({ ...headerCms, backgroundMode: e.target.value })}
                className="w-full rounded-xl border border-charcoal/20 p-2.5 text-xs focus:border-terracotta focus:outline-none"
              >
                <option value="surface">Theme Surface / Solid White</option>
                <option value="transparent">Transparent (Hero Overlay)</option>
              </select>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                id="showDivider"
                checked={headerCms.showDivider !== false}
                onChange={(e) => setHeaderCms({ ...headerCms, showDivider: e.target.checked })}
                className="h-4 w-4 rounded border-charcoal/20 text-terracotta focus:ring-terracotta"
              />
              <label htmlFor="showDivider" className="text-xs font-semibold text-charcoal cursor-pointer">
                Show bottom border / divider line under header
              </label>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Utility Bar CMS */}
      {activeTab === "utilityBar" && (
        <div className="space-y-6 rounded-2xl border border-charcoal/10 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-charcoal/10 pb-3">
            <div>
              <h3 className="text-sm font-bold text-charcoal uppercase tracking-wider">
                2. Top Utility Bar CMS
              </h3>
              <p className="text-xs text-charcoal-soft mt-0.5">
                Manage left-side trust badges, center promotional messages, and right-side action links.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-charcoal cursor-pointer">
              <input
                type="checkbox"
                checked={headerCms.utilityBar.enabled !== false}
                onChange={(e) =>
                  setHeaderCms({
                    ...headerCms,
                    utilityBar: { ...headerCms.utilityBar, enabled: e.target.checked },
                  })
                }
                className="h-4 w-4 rounded text-terracotta"
              />
              Enable Utility Bar
            </label>
          </div>

          {/* Center Message CMS */}
          <div className="space-y-4 rounded-xl border border-charcoal/10 bg-ivory-dark/20 p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-charcoal">Center Promotional Announcement</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-charcoal block mb-1">Center Text</label>
                <input
                  type="text"
                  value={headerCms.utilityBar.centerMessage || ""}
                  onChange={(e) =>
                    setHeaderCms({
                      ...headerCms,
                      utilityBar: { ...headerCms.utilityBar, centerMessage: e.target.value },
                    })
                  }
                  placeholder="e.g. Free Shipping above {{freeShippingThreshold}}"
                  className="w-full rounded-lg border border-charcoal/20 p-2 text-xs"
                />
                <p className="text-[10px] text-charcoal-soft mt-1">
                  Supports placeholders: <code>{"{{freeShippingThreshold}}"}</code>, <code>{"{{storeName}}"}</code>
                </p>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-charcoal block mb-1">Optional Center Link URL</label>
                <input
                  type="text"
                  value={headerCms.utilityBar.centerMessageLink || ""}
                  onChange={(e) =>
                    setHeaderCms({
                      ...headerCms,
                      utilityBar: { ...headerCms.utilityBar, centerMessageLink: e.target.value },
                    })
                  }
                  placeholder="/shipping"
                  className="w-full rounded-lg border border-charcoal/20 p-2 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Utility Items List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-charcoal">Utility Bar Items ({headerCms.utilityBar.items?.length || 0})</h4>
              <Button onClick={handleAddUtilityItem} className="bg-charcoal text-white text-xs py-1 px-3">
                + Add Utility Item
              </Button>
            </div>

            <div className="space-y-3">
              {(headerCms.utilityBar.items || []).map((item, idx) => (
                <div key={item.id || idx} className="rounded-xl border border-charcoal/15 bg-white p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 border-b border-charcoal/10 pb-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={item.enabled !== false}
                        onChange={(e) => handleUpdateUtilityItem(idx, { enabled: e.target.checked })}
                        className="h-4 w-4 rounded text-terracotta"
                      />
                      <span className="text-xs font-bold text-charcoal">Item #{idx + 1}: {item.label || item.title || "Untitled"}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveUtilityItem(idx, -1)}
                        disabled={idx === 0}
                        className="rounded p-1 text-xs text-stone-500 hover:bg-stone-100 disabled:opacity-30"
                        title="Move Up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveUtilityItem(idx, 1)}
                        disabled={idx === (headerCms.utilityBar.items?.length || 0) - 1}
                        className="rounded p-1 text-xs text-stone-500 hover:bg-stone-100 disabled:opacity-30"
                        title="Move Down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteUtilityItem(idx)}
                        className="rounded p-1 text-xs text-red-600 hover:bg-red-50 ml-2"
                        title="Delete Item"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-charcoal block mb-1">Display Label</label>
                      <input
                        type="text"
                        value={item.label || item.title || ""}
                        onChange={(e) => handleUpdateUtilityItem(idx, { label: e.target.value })}
                        className="w-full rounded-lg border border-charcoal/20 p-1.5 text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-charcoal block mb-1">Icon</label>
                      <select
                        value={item.icon || "truck"}
                        onChange={(e) => handleUpdateUtilityItem(idx, { icon: e.target.value })}
                        className="w-full rounded-lg border border-charcoal/20 p-1.5 text-xs"
                      >
                        <option value="truck">Truck (Shipping)</option>
                        <option value="returns">Returns / Refresh</option>
                        <option value="shield">Shield (Security)</option>
                        <option value="location">Location (Track Order)</option>
                        <option value="help">Help / FAQ</option>
                        <option value="phone">Phone / Contact</option>
                        <option value="gift">Gift / Offer</option>
                        <option value="sparkle">Sparkle</option>
                        <option value="none">None</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-charcoal block mb-1">Target URL</label>
                      <input
                        type="text"
                        value={item.url || item.link || ""}
                        onChange={(e) => handleUpdateUtilityItem(idx, { url: e.target.value, link: e.target.value })}
                        placeholder="/shipping"
                        className="w-full rounded-lg border border-charcoal/20 p-1.5 text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Announcement Ticker */}
      {activeTab === "promoTicker" && (
        <div className="space-y-6 rounded-2xl border border-charcoal/10 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-charcoal/10 pb-3">
            <div>
              <h3 className="text-sm font-bold text-charcoal uppercase tracking-wider">
                3. Announcement Ticker Presentation CMS
              </h3>
              <p className="text-xs text-charcoal-soft mt-0.5">
                Configure ticker visibility, marquee animation speed, separator style, and empty fallback messages. Promo content remains driven by <code>/admin/promos</code>.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-charcoal cursor-pointer">
              <input
                type="checkbox"
                checked={headerCms.promoTicker.enabled !== false}
                onChange={(e) =>
                  setHeaderCms({
                    ...headerCms,
                    promoTicker: { ...headerCms.promoTicker, enabled: e.target.checked },
                  })
                }
                className="h-4 w-4 rounded text-terracotta"
              />
              Enable Ticker Bar
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-charcoal">Marquee Speed (Seconds)</label>
              <input
                type="number"
                min={10}
                max={300}
                value={headerCms.promoTicker.speed || 90}
                onChange={(e) =>
                  setHeaderCms({
                    ...headerCms,
                    promoTicker: { ...headerCms.promoTicker, speed: Number(e.target.value) },
                  })
                }
                className="w-full rounded-xl border border-charcoal/20 p-2.5 text-xs"
              />
              <p className="text-[11px] text-charcoal-soft">Duration of full marquee loop in seconds (10 to 300s).</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-charcoal">Message Separator Style</label>
              <select
                value={headerCms.promoTicker.separator || "dot"}
                onChange={(e) =>
                  setHeaderCms({
                    ...headerCms,
                    promoTicker: { ...headerCms.promoTicker, separator: e.target.value },
                  })
                }
                className="w-full rounded-xl border border-charcoal/20 p-2.5 text-xs"
              >
                <option value="dot">• Bullet Dot</option>
                <option value="diamond">◆ Diamond</option>
                <option value="line">| Vertical Pipe</option>
                <option value="none">None</option>
              </select>
            </div>

            <div className="space-y-2 col-span-2">
              <label className="text-xs font-bold text-charcoal">Fallback Ticker Message (When no promos active)</label>
              <input
                type="text"
                value={headerCms.promoTicker.fallbackMessage || ""}
                onChange={(e) =>
                  setHeaderCms({
                    ...headerCms,
                    promoTicker: { ...headerCms.promoTicker, fallbackMessage: e.target.value },
                  })
                }
                placeholder="Crafted by Master Indian Artisans • Free Delivery Above ₹2,499"
                className="w-full rounded-xl border border-charcoal/20 p-2.5 text-xs"
              />
            </div>

            <div className="flex items-center gap-6 col-span-2 pt-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-charcoal cursor-pointer">
                <input
                  type="checkbox"
                  checked={headerCms.promoTicker.pauseOnHover !== false}
                  onChange={(e) =>
                    setHeaderCms({
                      ...headerCms,
                      promoTicker: { ...headerCms.promoTicker, pauseOnHover: e.target.checked },
                    })
                  }
                  className="h-4 w-4 rounded text-terracotta"
                />
                Pause ticker animation on hover
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-charcoal cursor-pointer">
                <input
                  type="checkbox"
                  checked={headerCms.promoTicker.showCouponCode !== false}
                  onChange={(e) =>
                    setHeaderCms({
                      ...headerCms,
                      promoTicker: { ...headerCms.promoTicker, showCouponCode: e.target.checked },
                    })
                  }
                  className="h-4 w-4 rounded text-terracotta"
                />
                Show coupon code copy badge
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-charcoal cursor-pointer">
                <input
                  type="checkbox"
                  checked={headerCms.promoTicker.showCta !== false}
                  onChange={(e) =>
                    setHeaderCms({
                      ...headerCms,
                      promoTicker: { ...headerCms.promoTicker, showCta: e.target.checked },
                    })
                  }
                  className="h-4 w-4 rounded text-terracotta"
                />
                Show CTA link button
              </label>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Main Header Controls */}
      {activeTab === "mainHeader" && (
        <div className="space-y-6 rounded-2xl border border-charcoal/10 bg-white p-6 shadow-xs">
          <h3 className="text-sm font-bold text-charcoal uppercase tracking-wider border-b border-charcoal/10 pb-2">
            4. Main Header Search, Logo &amp; Action Toggles
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-charcoal">Search Input Placeholder</label>
              <input
                type="text"
                value={headerCms.mainHeader.searchPlaceholder || ""}
                onChange={(e) =>
                  setHeaderCms({
                    ...headerCms,
                    mainHeader: { ...headerCms.mainHeader, searchPlaceholder: e.target.value },
                  })
                }
                className="w-full rounded-xl border border-charcoal/20 p-2.5 text-xs"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-charcoal">Brand Logo Desktop Alignment</label>
              <select
                value={headerCms.mainHeader.logoAlignment || "center"}
                onChange={(e) =>
                  setHeaderCms({
                    ...headerCms,
                    mainHeader: { ...headerCms.mainHeader, logoAlignment: e.target.value },
                  })
                }
                className="w-full rounded-xl border border-charcoal/20 p-2.5 text-xs"
              >
                <option value="center">Centered Logo (Aadya Signature Layout)</option>
                <option value="left">Left Aligned Logo</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-charcoal">Account Link Label</label>
              <input
                type="text"
                value={headerCms.mainHeader.accountLabel || "Login"}
                onChange={(e) =>
                  setHeaderCms({
                    ...headerCms,
                    mainHeader: { ...headerCms.mainHeader, accountLabel: e.target.value },
                  })
                }
                className="w-full rounded-xl border border-charcoal/20 p-2.5 text-xs"
              />
            </div>

            <div className="space-y-3 col-span-2 pt-2">
              <h4 className="text-xs font-bold text-charcoal uppercase tracking-wider">Header Action Visibility Toggles</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <label className="flex items-center gap-2 text-xs font-semibold text-charcoal cursor-pointer">
                  <input
                    type="checkbox"
                    checked={headerCms.mainHeader.showSearch !== false}
                    onChange={(e) =>
                      setHeaderCms({
                        ...headerCms,
                        mainHeader: { ...headerCms.mainHeader, showSearch: e.target.checked },
                      })
                    }
                    className="h-4 w-4 rounded text-terracotta"
                  />
                  Search Bar
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-charcoal cursor-pointer">
                  <input
                    type="checkbox"
                    checked={headerCms.mainHeader.showAccount !== false}
                    onChange={(e) =>
                      setHeaderCms({
                        ...headerCms,
                        mainHeader: { ...headerCms.mainHeader, showAccount: e.target.checked },
                      })
                    }
                    className="h-4 w-4 rounded text-terracotta"
                  />
                  Account Link
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-charcoal cursor-pointer">
                  <input
                    type="checkbox"
                    checked={headerCms.mainHeader.showWishlist !== false}
                    onChange={(e) =>
                      setHeaderCms({
                        ...headerCms,
                        mainHeader: { ...headerCms.mainHeader, showWishlist: e.target.checked },
                      })
                    }
                    className="h-4 w-4 rounded text-terracotta"
                  />
                  Wishlist Icon
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-charcoal cursor-pointer">
                  <input
                    type="checkbox"
                    checked={headerCms.mainHeader.showCart !== false}
                    onChange={(e) =>
                      setHeaderCms({
                        ...headerCms,
                        mainHeader: { ...headerCms.mainHeader, showCart: e.target.checked },
                      })
                    }
                    className="h-4 w-4 rounded text-terracotta"
                  />
                  Cart Icon &amp; Badge
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Primary Navigation */}
      {activeTab === "primaryNav" && (
        <div className="space-y-6 rounded-2xl border border-charcoal/10 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-charcoal/10 pb-3">
            <div>
              <h3 className="text-sm font-bold text-charcoal uppercase tracking-wider">
                5. Primary Navigation CMS
              </h3>
              <p className="text-xs text-charcoal-soft mt-0.5">
                Choose AUTO mode (category hierarchy driven) or MANUAL mode (admin builder driven).
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-charcoal cursor-pointer">
              <input
                type="checkbox"
                checked={headerCms.primaryNav.enabled !== false}
                onChange={(e) =>
                  setHeaderCms({
                    ...headerCms,
                    primaryNav: { ...headerCms.primaryNav, enabled: e.target.checked },
                  })
                }
                className="h-4 w-4 rounded text-terracotta"
              />
              Enable Primary Navigation
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-charcoal">Navigation Mode</label>
              <select
                value={headerCms.primaryNav.mode || "AUTO"}
                onChange={(e) =>
                  setHeaderCms({
                    ...headerCms,
                    primaryNav: { ...headerCms.primaryNav, mode: e.target.value },
                  })
                }
                className="w-full rounded-xl border border-charcoal/20 p-2.5 text-xs font-bold"
              >
                <option value="AUTO">AUTO (Category Hierarchy Driven)</option>
                <option value="MANUAL">MANUAL (Admin-configured items &amp; mega menus)</option>
              </select>
            </div>

            <div className="flex items-center gap-6 pt-6">
              <label className="flex items-center gap-2 text-xs font-semibold text-charcoal cursor-pointer">
                <input
                  type="checkbox"
                  checked={headerCms.primaryNav.showNewBadge !== false}
                  onChange={(e) =>
                    setHeaderCms({
                      ...headerCms,
                      primaryNav: { ...headerCms.primaryNav, showNewBadge: e.target.checked },
                    })
                  }
                  className="h-4 w-4 rounded text-terracotta"
                />
                Show "NEW" Badge on First/New Arrivals Item
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-charcoal cursor-pointer">
                <input
                  type="checkbox"
                  checked={headerCms.primaryNav.enableMegaMenu !== false}
                  onChange={(e) =>
                    setHeaderCms({
                      ...headerCms,
                      primaryNav: { ...headerCms.primaryNav, enableMegaMenu: e.target.checked },
                    })
                  }
                  className="h-4 w-4 rounded text-terracotta"
                />
                Enable Mega Menu Dropdown on Hover
              </label>
            </div>
          </div>

          {/* Manual Menu Items List */}
          {headerCms.primaryNav.mode === "MANUAL" && (
            <div className="space-y-3 pt-4 border-t border-charcoal/10">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-charcoal">Manual Nav Items ({headerCms.primaryNav.items?.length || 0})</h4>
                <Button onClick={handleAddNavItem} className="bg-charcoal text-white text-xs py-1 px-3">
                  + Add Navigation Item
                </Button>
              </div>

              <div className="space-y-3">
                {(headerCms.primaryNav.items || []).map((item, idx) => (
                  <NavItemEditor
                    key={item.id || idx}
                    item={item}
                    index={idx}
                    total={headerCms.primaryNav.items?.length || 0}
                    categories={categories}
                    onChange={(updates) => handleUpdateNavItem(idx, updates)}
                    onMove={(dir) => handleMoveNavItem(idx, dir)}
                    onDelete={() => handleDeleteNavItem(idx)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: Mega Menu CMS */}
      {activeTab === "megaMenu" && (
        <div className="space-y-6 rounded-2xl border border-charcoal/10 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-charcoal/10 pb-3">
            <div>
              <h3 className="text-sm font-bold text-charcoal uppercase tracking-wider">
                6. Mega Menu Dropdown CMS
              </h3>
              <p className="text-xs text-charcoal-soft mt-0.5">
                Configure dropdown grid column count and the right-side promotional feature card.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-charcoal cursor-pointer">
              <input
                type="checkbox"
                checked={headerCms.megaMenu.enabled !== false}
                onChange={(e) =>
                  setHeaderCms({
                    ...headerCms,
                    megaMenu: { ...headerCms.megaMenu, enabled: e.target.checked },
                  })
                }
                className="h-4 w-4 rounded text-terracotta"
              />
              Enable Mega Menu
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-charcoal">Subcategory Columns Count (2 to 5)</label>
              <input
                type="number"
                min={2}
                max={5}
                value={headerCms.megaMenu.columns || 4}
                onChange={(e) =>
                  setHeaderCms({
                    ...headerCms,
                    megaMenu: { ...headerCms.megaMenu, columns: Number(e.target.value) },
                  })
                }
                className="w-full rounded-xl border border-charcoal/20 p-2.5 text-xs font-bold"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-charcoal">Mega Menu Container Width</label>
              <select
                value={headerCms.megaMenu.dropdownWidth || "full"}
                onChange={(e) =>
                  setHeaderCms({
                    ...headerCms,
                    megaMenu: { ...headerCms.megaMenu, dropdownWidth: e.target.value },
                  })
                }
                className="w-full rounded-xl border border-charcoal/20 p-2.5 text-xs font-bold"
              >
                <option value="full">Full Container Width (1280px Grid)</option>
                <option value="contained">Contained Compact Width</option>
              </select>
            </div>
          </div>

          {/* Right-side Promo Card Controls */}
          <div className="space-y-4 rounded-xl border border-charcoal/10 bg-ivory-dark/20 p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-charcoal">Right Promotional Card</h4>
              <label className="flex items-center gap-2 text-xs font-semibold text-charcoal cursor-pointer">
                <input
                  type="checkbox"
                  checked={headerCms.megaMenu.promoCard?.enabled !== false}
                  onChange={(e) =>
                    setHeaderCms({
                      ...headerCms,
                      megaMenu: {
                        ...headerCms.megaMenu,
                        promoCard: { ...headerCms.megaMenu.promoCard, enabled: e.target.checked },
                      },
                    })
                  }
                  className="h-4 w-4 rounded text-terracotta"
                />
                Show Promo Card
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ImagePickerInput
                label="Card Image"
                value={headerCms.megaMenu.promoCard?.image || ""}
                onChange={(imgUrl) =>
                  setHeaderCms({
                    ...headerCms,
                    megaMenu: {
                      ...headerCms.megaMenu,
                      promoCard: { ...headerCms.megaMenu.promoCard, image: imgUrl },
                    },
                  })
                }
                placeholder="Upload or choose promo image"
              />

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-charcoal block mb-1">Eyebrow Tag</label>
                  <input
                    type="text"
                    value={headerCms.megaMenu.promoCard?.eyebrow || ""}
                    onChange={(e) =>
                      setHeaderCms({
                        ...headerCms,
                        megaMenu: {
                          ...headerCms.megaMenu,
                          promoCard: { ...headerCms.megaMenu.promoCard, eyebrow: e.target.value },
                        },
                      })
                    }
                    placeholder="Curated Edit"
                    className="w-full rounded-lg border border-charcoal/20 p-1.5 text-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-charcoal block mb-1">Card Title</label>
                  <input
                    type="text"
                    value={headerCms.megaMenu.promoCard?.title || ""}
                    onChange={(e) =>
                      setHeaderCms({
                        ...headerCms,
                        megaMenu: {
                          ...headerCms.megaMenu,
                          promoCard: { ...headerCms.megaMenu.promoCard, title: e.target.value },
                        },
                      })
                    }
                    placeholder="Artisan Craftsmanship"
                    className="w-full rounded-lg border border-charcoal/20 p-1.5 text-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-charcoal block mb-1">CTA Label &amp; Link</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={headerCms.megaMenu.promoCard?.ctaLabel || ""}
                      onChange={(e) =>
                        setHeaderCms({
                          ...headerCms,
                          megaMenu: {
                            ...headerCms.megaMenu,
                            promoCard: { ...headerCms.megaMenu.promoCard, ctaLabel: e.target.value },
                          },
                        })
                      }
                      placeholder="Shop Now →"
                      className="w-1/2 rounded-lg border border-charcoal/20 p-1.5 text-xs"
                    />
                    <input
                      type="text"
                      value={headerCms.megaMenu.promoCard?.ctaUrl || ""}
                      onChange={(e) =>
                        setHeaderCms({
                          ...headerCms,
                          megaMenu: {
                            ...headerCms.megaMenu,
                            promoCard: { ...headerCms.megaMenu.promoCard, ctaUrl: e.target.value },
                          },
                        })
                      }
                      placeholder="/shop"
                      className="w-1/2 rounded-lg border border-charcoal/20 p-1.5 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: Circular Category Strip */}
      {activeTab === "circularCategories" && (
        <div className="space-y-6 rounded-2xl border border-charcoal/10 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-charcoal/10 pb-3">
            <div>
              <h3 className="text-sm font-bold text-charcoal uppercase tracking-wider">
                7. Circular Category Scroller Strip CMS
              </h3>
              <p className="text-xs text-charcoal-soft mt-0.5">
                Configure visibility, maximum display count, desktop scroll arrows, and circle sizing.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-charcoal cursor-pointer">
              <input
                type="checkbox"
                checked={headerCms.circularCategories.enabled !== false}
                onChange={(e) =>
                  setHeaderCms({
                    ...headerCms,
                    circularCategories: { ...headerCms.circularCategories, enabled: e.target.checked },
                  })
                }
                className="h-4 w-4 rounded text-terracotta"
              />
              Enable Category Strip
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-charcoal">Category Source Mode</label>
              <select
                value={headerCms.circularCategories.mode || "AUTO"}
                onChange={(e) =>
                  setHeaderCms({
                    ...headerCms,
                    circularCategories: { ...headerCms.circularCategories, mode: e.target.value },
                  })
                }
                className="w-full rounded-xl border border-charcoal/20 p-2.5 text-xs font-bold"
              >
                <option value="AUTO">AUTO (All Active Store Categories)</option>
                <option value="MANUAL">MANUAL (Custom Selected Categories)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-charcoal">Maximum Categories Count (1 to 24)</label>
              <input
                type="number"
                min={1}
                max={24}
                value={headerCms.circularCategories.maxItems || 12}
                onChange={(e) =>
                  setHeaderCms({
                    ...headerCms,
                    circularCategories: {
                      ...headerCms.circularCategories,
                      maxItems: Number(e.target.value),
                    },
                  })
                }
                className="w-full rounded-xl border border-charcoal/20 p-2.5 text-xs font-bold"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-charcoal">Desktop Circle Size</label>
              <select
                value={headerCms.circularCategories.desktopSize || "medium"}
                onChange={(e) =>
                  setHeaderCms({
                    ...headerCms,
                    circularCategories: {
                      ...headerCms.circularCategories,
                      desktopSize: e.target.value,
                    },
                  })
                }
                className="w-full rounded-xl border border-charcoal/20 p-2.5 text-xs"
              >
                <option value="small">Small (14-18px circles)</option>
                <option value="medium">Medium (18-22px circles - Standard)</option>
                <option value="large">Large (20-26px circles)</option>
              </select>
            </div>

            <div className="flex items-center gap-6 col-span-3 pt-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-charcoal cursor-pointer">
                <input
                  type="checkbox"
                  checked={headerCms.circularCategories.showArrows !== false}
                  onChange={(e) =>
                    setHeaderCms({
                      ...headerCms,
                      circularCategories: {
                        ...headerCms.circularCategories,
                        showArrows: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4 rounded text-terracotta"
                />
                Show Desktop Left/Right Scroll Arrows
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-charcoal cursor-pointer">
                <input
                  type="checkbox"
                  checked={headerCms.circularCategories.showLabels !== false}
                  onChange={(e) =>
                    setHeaderCms({
                      ...headerCms,
                      circularCategories: {
                        ...headerCms.circularCategories,
                        showLabels: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4 rounded text-terracotta"
                />
                Show Category Name Labels Under Circles
              </label>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: Mobile Navigation */}
      {activeTab === "mobile" && (
        <div className="space-y-6 rounded-2xl border border-charcoal/10 bg-white p-6 shadow-xs">
          <h3 className="text-sm font-bold text-charcoal uppercase tracking-wider border-b border-charcoal/10 pb-2">
            8. Mobile Navigation Drawer Controls
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-charcoal">Mobile Drawer Title</label>
              <input
                type="text"
                value={headerCms.mobile.drawerTitle || "Menu"}
                onChange={(e) =>
                  setHeaderCms({
                    ...headerCms,
                    mobile: { ...headerCms.mobile, drawerTitle: e.target.value },
                  })
                }
                className="w-full rounded-xl border border-charcoal/20 p-2.5 text-xs"
              />
            </div>

            <div className="space-y-3 col-span-2 pt-2">
              <h4 className="text-xs font-bold text-charcoal uppercase tracking-wider">Mobile Component Toggles</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <label className="flex items-center gap-2 text-xs font-semibold text-charcoal cursor-pointer">
                  <input
                    type="checkbox"
                    checked={headerCms.mobile.showSearch !== false}
                    onChange={(e) =>
                      setHeaderCms({
                        ...headerCms,
                        mobile: { ...headerCms.mobile, showSearch: e.target.checked },
                      })
                    }
                    className="h-4 w-4 rounded text-terracotta"
                  />
                  Search Icon
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-charcoal cursor-pointer">
                  <input
                    type="checkbox"
                    checked={headerCms.mobile.showCart !== false}
                    onChange={(e) =>
                      setHeaderCms({
                        ...headerCms,
                        mobile: { ...headerCms.mobile, showCart: e.target.checked },
                      })
                    }
                    className="h-4 w-4 rounded text-terracotta"
                  />
                  Cart Icon &amp; Badge
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-charcoal cursor-pointer">
                  <input
                    type="checkbox"
                    checked={headerCms.mobile.showAccordionChildren !== false}
                    onChange={(e) =>
                      setHeaderCms({
                        ...headerCms,
                        mobile: { ...headerCms.mobile, showAccordionChildren: e.target.checked },
                      })
                    }
                    className="h-4 w-4 rounded text-terracotta"
                  />
                  Show Category Accordion Expanders
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 9: Live Preview */}
      {activeTab === "preview" && (
        <div className="space-y-4 rounded-2xl border border-charcoal/10 bg-stone-100 p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-charcoal/10 pb-3">
            <div>
              <h3 className="text-sm font-bold text-charcoal uppercase tracking-wider">
                9. Live Header Preview
              </h3>
              <p className="text-xs text-charcoal-soft mt-0.5">
                Simulate your header settings directly before saving.
              </p>
            </div>
            <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-charcoal/10">
              <button
                type="button"
                onClick={() => setPreviewViewport("desktop")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                  previewViewport === "desktop" ? "bg-charcoal text-white" : "text-stone-600 hover:bg-stone-100"
                }`}
              >
                Desktop (1280px)
              </button>
              <button
                type="button"
                onClick={() => setPreviewViewport("mobile")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                  previewViewport === "mobile" ? "bg-charcoal text-white" : "text-stone-600 hover:bg-stone-100"
                }`}
              >
                Mobile (390px)
              </button>
            </div>
          </div>

          {previewMenuItems.length > 0 && (
            <div className="flex flex-wrap items-center gap-2" data-testid="preview-menu-picker">
              <span className="text-[11px] font-bold uppercase tracking-wider text-charcoal">Preview mega menu:</span>
              <button type="button" onClick={() => setPreviewMenuId("")} className={`rounded-full border px-3 py-1 text-xs font-semibold ${!previewMenuId ? "bg-charcoal text-white" : "bg-white text-stone-600"}`}>None</button>
              {previewMenuItems.map((i) => (
                <button key={i.id} type="button" onClick={() => setPreviewMenuId(i.id)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${previewMenuId === i.id ? "bg-charcoal text-white" : "bg-white text-stone-600"}`}>{i.label}</button>
              ))}
            </div>
          )}

          <div
            className={`mx-auto overflow-hidden rounded-xl border border-stone-300 bg-white shadow-lg transition-all duration-300 ${
              previewViewport === "mobile" ? "max-w-[390px]" : "w-full max-w-6xl"
            }`}
          >
            {/* Render Preview Header Component structure */}
            <div className="pointer-events-none select-none">
              {headerCms.utilityBar.enabled !== false && <TopUtilityBar />}
              {headerCms.promoTicker.enabled !== false && <PromoStrip />}

              <div className="p-4 border-b border-stone-200 flex items-center justify-between">
                {headerCms.mainHeader.showSearch !== false && (
                  <div className="text-xs text-stone-400 border-b border-stone-300 pb-1 max-w-[180px]">
                    {headerCms.mainHeader.searchPlaceholder || "Search..."}
                  </div>
                )}
                <BrandLogo
                  src={fullSettings.branding?.desktopLogo}
                  fallbackText={fullSettings.general?.storeName || "Aadya"}
                  widthPx={120}
                  maxHeightPx={40}
                />
                <div className="flex gap-3 text-xs font-bold text-stone-700">
                  {headerCms.mainHeader.showAccount !== false && <span>Login</span>}
                  {headerCms.mainHeader.showCart !== false && <span>Cart (0)</span>}
                </div>
              </div>

              {headerCms.primaryNav.enabled !== false && previewViewport === "desktop" && previewNavItems.length > 0 && (
                <div className="border-t border-stone-200 bg-white min-h-[44px]">
                  <PrimaryNav
                    items={previewNavItems}
                    maxColumns={headerCms.megaMenu.columns || 4}
                    menuWidth={headerCms.megaMenu.dropdownWidth}
                    showBadges={headerCms.primaryNav.showNewBadge !== false}
                    forcedOpenId={previewMenuId || null}
                  />
                </div>
              )}

              {headerCms.circularCategories.enabled === true && (
                <CircularCategoryNav categories={categories} />
              )}

              <div className="flex h-24 items-center justify-center bg-stone-200 text-[11px] font-semibold uppercase tracking-widest text-stone-500">
                Hero starts here
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
