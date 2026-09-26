import { useEffect, useState } from "react";
import {
  adminFetchSiteSettings,
  adminUpdateSiteSettings,
  adminResetAppearanceSettings,
  adminListPages,
} from "../../lib/api";
import { Button } from "../../components/ui";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";
import MediaPicker from "../../components/cms/MediaPicker";
import { applyThemeVariables, DEFAULT_SITE_SETTINGS } from "../../hooks/useSiteSettings";

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState("general");
  const [status, setStatus] = useState("loading");
  const [settings, setSettings] = useState(DEFAULT_SITE_SETTINGS);
  const [pages, setPages] = useState([]);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [isMediaOpen, setIsMediaOpen] = useState(false);
  const [mediaTargetField, setMediaTargetField] = useState(null);

  useEffect(() => {
    Promise.all([
      adminFetchSiteSettings(),
      adminListPages().catch(() => ({ data: [] })),
    ])
      .then(([settingsRes, pagesRes]) => {
        if (settingsRes.data) {
          setSettings(settingsRes.data);
          if (settingsRes.data.appearance) {
            applyThemeVariables(settingsRes.data.appearance);
          }
        }
        setPages(pagesRes.items || pagesRes.data || []);
        setStatus("ready");
      })
      .catch((err) => {
        setError(err.message || "Failed to load store settings.");
        setStatus("error");
      });
  }, []);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      const res = await adminUpdateSiteSettings(settings);
      if (res.data) {
        setSettings(res.data);
        if (res.data.appearance) {
          applyThemeVariables(res.data.appearance);
        }
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message || "Could not save settings.");
    }
  };

  const handleResetAppearance = async () => {
    if (!window.confirm("Reset all appearance and theme colors to Aadya defaults?")) return;
    setError(null);
    setSaved(false);
    try {
      const res = await adminResetAppearanceSettings();
      if (res.data) {
        setSettings(res.data);
        if (res.data.appearance) {
          applyThemeVariables(res.data.appearance);
        }
      }
      setSaved(true);
    } catch (err) {
      setError(err.message || "Could not reset appearance.");
    }
  };

  const openMediaPicker = (fieldPath) => {
    setMediaTargetField(fieldPath);
    setIsMediaOpen(true);
  };

  const handleMediaSelect = (asset) => {
    if (!mediaTargetField) return;
    const url = asset.url;

    // Helper to update nested state
    setSettings((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      const parts = mediaTargetField.split(".");
      let curr = copy;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!curr[parts[i]]) curr[parts[i]] = {};
        curr = curr[parts[i]];
      }
      curr[parts[parts.length - 1]] = url;
      return copy;
    });

    setIsMediaOpen(false);
    setMediaTargetField(null);
  };

  if (status === "loading") return <LoadingNotice label="Loading store settings…" />;
  if (status === "error") return <ErrorNotice message={error || "Unable to load settings."} />;

  const tabs = [
    { id: "general", label: "General Store" },
    { id: "branding", label: "Branding & Logo" },
    { id: "header", label: "Header & Nav" },
    { id: "footer", label: "Footer System" },
    { id: "appearance", label: "Appearance / Theme" },
    { id: "social", label: "Contact & Social" },
    { id: "shipping", label: "Shipping Rules" },
    { id: "payments", label: "Payment Methods" },
    { id: "checkout", label: "Checkout Options" },
    { id: "shop", label: "Shop Display" },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-charcoal/10 pb-4">
        <div>
          <h1 className="font-serif-display text-2xl text-charcoal font-bold">Storefront Settings &amp; Theme</h1>
          <p className="text-xs text-charcoal-soft mt-1">Configure global store identity, dynamic navigation header/footer, shipping &amp; checkout authority.</p>
        </div>
        <Button onClick={handleSave} className="bg-terracotta text-white self-start sm:self-auto">
          Save All Settings
        </Button>
      </div>

      {saved && (
        <div className="rounded-xl bg-sage-light px-4 py-3 text-xs font-semibold text-green-deep animate-fade-up">
          ✓ Store settings successfully saved &amp; applied to live storefront!
        </div>
      )}
      {error && <p className="text-xs font-semibold text-terracotta">{error}</p>}

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar border-b border-charcoal/15 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-medium rounded-xl whitespace-nowrap transition ${
              activeTab === tab.id
                ? "bg-terracotta text-white font-semibold shadow-xs"
                : "text-charcoal-soft hover:bg-charcoal/5"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* TAB 1: GENERAL */}
        {activeTab === "general" && (
          <div className="space-y-4 rounded-2xl border border-charcoal/10 bg-white p-6 shadow-xs">
            <h2 className="font-serif text-lg font-bold text-charcoal">General Store Identity</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Store Public Name</label>
                <input
                  value={settings.general?.storeName || ""}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, general: { ...s.general, storeName: e.target.value } }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Legal Entity Name</label>
                <input
                  value={settings.general?.legalName || ""}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, general: { ...s.general, legalName: e.target.value } }))
                  }
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Short Store Description</label>
              <textarea
                rows={2}
                value={settings.general?.shortDescription || ""}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, general: { ...s.general, shortDescription: e.target.value } }))
                }
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Support Email</label>
                <input
                  type="email"
                  value={settings.general?.supportEmail || ""}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      supportEmail: e.target.value,
                      general: { ...s.general, supportEmail: e.target.value },
                    }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Support Phone</label>
                <input
                  value={settings.general?.supportPhone || ""}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      supportPhone: e.target.value,
                      general: { ...s.general, supportPhone: e.target.value },
                    }))
                  }
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Address</label>
                <input
                  value={settings.general?.businessAddress || ""}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, general: { ...s.general, businessAddress: e.target.value } }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">City</label>
                <input
                  value={settings.general?.city || ""}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, general: { ...s.general, city: e.target.value } }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Postal Code</label>
                <input
                  value={settings.general?.postalCode || ""}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, general: { ...s.general, postalCode: e.target.value } }))
                  }
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-2 border-t border-charcoal/10">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">GSTIN (Optional)</label>
                <input
                  value={settings.general?.GSTIN || ""}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, general: { ...s.general, GSTIN: e.target.value } }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">PAN (Optional)</label>
                <input
                  value={settings.general?.PAN || ""}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, general: { ...s.general, PAN: e.target.value } }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">CIN (Optional)</label>
                <input
                  value={settings.general?.CIN || ""}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, general: { ...s.general, CIN: e.target.value } }))
                  }
                  className={inputCls}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BRANDING */}
        {activeTab === "branding" && (
          <div className="space-y-4 rounded-2xl border border-charcoal/10 bg-white p-6 shadow-xs">
            <h2 className="font-serif text-lg font-bold text-charcoal">Branding &amp; Media Assets</h2>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Desktop Store Logo</label>
              <div className="flex gap-2 mt-1">
                <input
                  placeholder="Image URL or Media asset path"
                  value={settings.branding?.desktopLogo || ""}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, branding: { ...s.branding, desktopLogo: e.target.value } }))
                  }
                  className={inputCls}
                />
                <Button type="button" onClick={() => openMediaPicker("branding.desktopLogo")} className="bg-charcoal text-white shrink-0 text-xs">
                  Pick from Media
                </Button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Mobile Store Logo (Optional)</label>
              <div className="flex gap-2 mt-1">
                <input
                  placeholder="Image URL or Media asset path"
                  value={settings.branding?.mobileLogo || ""}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, branding: { ...s.branding, mobileLogo: e.target.value } }))
                  }
                  className={inputCls}
                />
                <Button type="button" onClick={() => openMediaPicker("branding.mobileLogo")} className="bg-charcoal text-white shrink-0 text-xs">
                  Pick from Media
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Logo Alt Text</label>
                <input
                  value={settings.branding?.logoAltText || ""}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, branding: { ...s.branding, logoAltText: e.target.value } }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Logo Width Desktop (px)</label>
                <input
                  type="number"
                  value={settings.branding?.logoWidthDesktop || 140}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, branding: { ...s.branding, logoWidthDesktop: Number(e.target.value) || 140 } }))
                  }
                  className={inputCls}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: HEADER */}
        {activeTab === "header" && (
          <div className="space-y-6 rounded-2xl border border-charcoal/10 bg-white p-6 shadow-xs">
            <h2 className="font-serif text-lg font-bold text-charcoal">Header &amp; Navigation Controls</h2>

            <div className="space-y-3 border-b border-charcoal/10 pb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-terracotta">Utility Top Bar</h3>
              <label className="flex items-center gap-2 text-xs font-medium text-charcoal cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.header?.showUtilityBar !== false}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, header: { ...s.header, showUtilityBar: e.target.checked } }))
                  }
                />
                Enable Slim Top Utility Bar
              </label>
            </div>

            <div className="space-y-3 border-b border-charcoal/10 pb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-terracotta">Announcement Bar Notice</h3>
              <input
                placeholder="Notice text (e.g. Free delivery above ₹2,499...)"
                value={settings.announcementBar?.text || ""}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    announcementBar: { ...s.announcementBar, text: e.target.value },
                  }))
                }
                className={inputCls}
              />
              <label className="flex items-center gap-2 text-xs font-medium text-charcoal cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.announcementBar?.active !== false}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      announcementBar: { ...s.announcementBar, active: e.target.checked },
                    }))
                  }
                />
                Show Announcement Bar on Header
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-xs font-medium text-charcoal cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.header?.showSearch !== false}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, header: { ...s.header, showSearch: e.target.checked } }))
                  }
                />
                Show Search Bar
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-charcoal cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.header?.showCategoryCircles !== false}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, header: { ...s.header, showCategoryCircles: e.target.checked } }))
                  }
                />
                Show Circular Category Navigation Strip
              </label>
            </div>
          </div>
        )}

        {/* TAB 4: FOOTER */}
        {activeTab === "footer" && (
          <div className="space-y-4 rounded-2xl border border-charcoal/10 bg-white p-6 shadow-xs">
            <h2 className="font-serif text-lg font-bold text-charcoal">Footer Configuration</h2>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Brand Description in Footer</label>
              <textarea
                rows={3}
                value={settings.footer?.brandDescription || ""}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, footer: { ...s.footer, brandDescription: e.target.value } }))
                }
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-xs font-medium text-charcoal cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.footer?.contactDetails !== false}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, footer: { ...s.footer, contactDetails: e.target.checked } }))
                  }
                />
                Show Contact Info in Footer
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-charcoal cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.footer?.socialLinksVisibility !== false}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, footer: { ...s.footer, socialLinksVisibility: e.target.checked } }))
                  }
                />
                Show Social Media Icons in Footer
              </label>
            </div>
          </div>
        )}

        {/* TAB 5: APPEARANCE */}
        {activeTab === "appearance" && (
          <div className="space-y-6 rounded-2xl border border-charcoal/10 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-charcoal/10 pb-4">
              <h2 className="font-serif text-lg font-bold text-charcoal">Theme &amp; Appearance Colors</h2>
              <Button type="button" onClick={handleResetAppearance} className="bg-charcoal/10 text-charcoal hover:bg-terracotta hover:text-white text-xs">
                Reset to Aadya Defaults
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft block mb-1">Primary Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.appearance?.colors?.primary || "#B8674A"}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        appearance: {
                          ...s.appearance,
                          colors: { ...s.appearance?.colors, primary: e.target.value },
                        },
                      }))
                    }
                    className="h-9 w-12 cursor-pointer rounded border border-charcoal/20"
                  />
                  <input
                    value={settings.appearance?.colors?.primary || "#B8674A"}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        appearance: {
                          ...s.appearance,
                          colors: { ...s.appearance?.colors, primary: e.target.value },
                        },
                      }))
                    }
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft block mb-1">Secondary Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.appearance?.colors?.secondary || "#8A9A82"}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        appearance: {
                          ...s.appearance,
                          colors: { ...s.appearance?.colors, secondary: e.target.value },
                        },
                      }))
                    }
                    className="h-9 w-12 cursor-pointer rounded border border-charcoal/20"
                  />
                  <input
                    value={settings.appearance?.colors?.secondary || "#8A9A82"}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        appearance: {
                          ...s.appearance,
                          colors: { ...s.appearance?.colors, secondary: e.target.value },
                        },
                      }))
                    }
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft block mb-1">Background</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.appearance?.colors?.background || "#FFFFFF"}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        appearance: {
                          ...s.appearance,
                          colors: { ...s.appearance?.colors, background: e.target.value },
                        },
                      }))
                    }
                    className="h-9 w-12 cursor-pointer rounded border border-charcoal/20"
                  />
                  <input
                    value={settings.appearance?.colors?.background || "#FFFFFF"}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        appearance: {
                          ...s.appearance,
                          colors: { ...s.appearance?.colors, background: e.target.value },
                        },
                      }))
                    }
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft block mb-1">Text Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.appearance?.colors?.text || "#2B2723"}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        appearance: {
                          ...s.appearance,
                          colors: { ...s.appearance?.colors, text: e.target.value },
                        },
                      }))
                    }
                    className="h-9 w-12 cursor-pointer rounded border border-charcoal/20"
                  />
                  <input
                    value={settings.appearance?.colors?.text || "#2B2723"}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        appearance: {
                          ...s.appearance,
                          colors: { ...s.appearance?.colors, text: e.target.value },
                        },
                      }))
                    }
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: SOCIAL */}
        {activeTab === "social" && (
          <div className="space-y-4 rounded-2xl border border-charcoal/10 bg-white p-6 shadow-xs">
            <h2 className="font-serif text-lg font-bold text-charcoal">Social Media Links</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Instagram URL</label>
                <input
                  placeholder="https://instagram.com/..."
                  value={settings.social?.instagram || ""}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, social: { ...s.social, instagram: e.target.value } }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Facebook URL</label>
                <input
                  placeholder="https://facebook.com/..."
                  value={settings.social?.facebook || ""}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, social: { ...s.social, facebook: e.target.value } }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">YouTube URL</label>
                <input
                  placeholder="https://youtube.com/..."
                  value={settings.social?.youtube || ""}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, social: { ...s.social, youtube: e.target.value } }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Pinterest URL</label>
                <input
                  placeholder="https://pinterest.com/..."
                  value={settings.social?.pinterest || ""}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, social: { ...s.social, pinterest: e.target.value } }))
                  }
                  className={inputCls}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: SHIPPING */}
        {activeTab === "shipping" && (
          <div className="space-y-4 rounded-2xl border border-charcoal/10 bg-white p-6 shadow-xs">
            <h2 className="font-serif text-lg font-bold text-charcoal">Server-Authoritative Shipping Rules</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Free Shipping Minimum Threshold (₹)</label>
                <input
                  type="number"
                  value={settings.shipping?.freeShippingThreshold ?? 2499}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      freeShippingThreshold: Number(e.target.value) || 0,
                      shipping: { ...s.shipping, freeShippingThreshold: Number(e.target.value) || 0 },
                    }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Standard Shipping Fee (₹)</label>
                <input
                  type="number"
                  value={settings.shipping?.standardShippingAmount ?? 150}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      standardShippingAmount: Number(e.target.value) || 0,
                      shipping: { ...s.shipping, standardShippingAmount: Number(e.target.value) || 0 },
                    }))
                  }
                  className={inputCls}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 8: PAYMENTS */}
        {activeTab === "payments" && (
          <div className="space-y-6 rounded-2xl border border-charcoal/10 bg-white p-6 shadow-xs">
            <h2 className="font-serif text-lg font-bold text-charcoal">Payment Method Gateways</h2>
            <div className="space-y-4 border-b border-charcoal/10 pb-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-charcoal cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.payments?.razorpayEnabled !== false}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      payments: { ...s.payments, razorpayEnabled: e.target.checked },
                    }))
                  }
                />
                Enable Razorpay Online Payment Gateway
              </label>
              <input
                placeholder="Razorpay Option Display Label"
                value={settings.payments?.razorpayDisplayLabel || ""}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    payments: { ...s.payments, razorpayDisplayLabel: e.target.value },
                  }))
                }
                className={inputCls}
              />
            </div>

            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-charcoal cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.payments?.codEnabled !== false}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      payments: { ...s.payments, codEnabled: e.target.checked },
                    }))
                  }
                />
                Enable Cash on Delivery (COD)
              </label>
              <input
                placeholder="COD Option Display Label"
                value={settings.payments?.codDisplayLabel || ""}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    payments: { ...s.payments, codDisplayLabel: e.target.value },
                  }))
                }
                className={inputCls}
              />
            </div>
          </div>
        )}

        {/* TAB 9: CHECKOUT */}
        {activeTab === "checkout" && (
          <div className="space-y-4 rounded-2xl border border-charcoal/10 bg-white p-6 shadow-xs">
            <h2 className="font-serif text-lg font-bold text-charcoal">Checkout &amp; Policy Page Links</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Terms of Service Page</label>
                <select
                  value={settings.checkout?.termsPageId || ""}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      checkout: { ...s.checkout, termsPageId: e.target.value },
                    }))
                  }
                  className={inputCls}
                >
                  <option value="">-- Select CMS Page --</option>
                  {pages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Privacy Policy Page</label>
                <select
                  value={settings.checkout?.privacyPageId || ""}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      checkout: { ...s.checkout, privacyPageId: e.target.value },
                    }))
                  }
                  className={inputCls}
                >
                  <option value="">-- Select CMS Page --</option>
                  {pages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.slug})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* TAB 10: SHOP */}
        {activeTab === "shop" && (
          <div className="space-y-4 rounded-2xl border border-charcoal/10 bg-white p-6 shadow-xs">
            <h2 className="font-serif text-lg font-bold text-charcoal">Shop &amp; Catalog Layout</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Products Per Page</label>
                <input
                  type="number"
                  value={settings.shop?.productsPerPage || 12}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      shop: { ...s.shop, productsPerPage: Number(e.target.value) || 12 },
                    }))
                  }
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Desktop Grid Columns</label>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={settings.shop?.desktopGridColumns || 3}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      shop: { ...s.shop, desktopGridColumns: Number(e.target.value) || 3 },
                    }))
                  }
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Default Sort Order</label>
                <select
                  value={settings.shop?.defaultSort || "featured"}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      shop: { ...s.shop, defaultSort: e.target.value },
                    }))
                  }
                  className={inputCls}
                >
                  <option value="featured">Featured</option>
                  <option value="newest">Newest Arrivals</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Media Picker Modal */}
      <MediaPicker
        isOpen={isMediaOpen}
        onClose={() => setIsMediaOpen(false)}
        onSelect={handleMediaSelect}
        title="Select Logo Image"
      />
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-charcoal/15 px-4 py-2 text-xs sm:text-sm focus:border-terracotta focus:outline-none bg-white text-charcoal";
