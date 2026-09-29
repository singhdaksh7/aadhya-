import { useEffect, useState } from "react";
import {
  adminFetchSiteSettings,
  adminUpdateSiteSettings,
  adminResetAppearanceSettings,
  adminListPages,
} from "../../lib/api";
import { Button } from "../../components/ui";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";
import ImagePickerInput from "../../components/admin/ImagePickerInput";
import { applyThemeVariables, DEFAULT_SITE_SETTINGS, refreshSiteSettings } from "../../hooks/useSiteSettings";

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState("general");
  const [status, setStatus] = useState("loading");
  const [settings, setSettings] = useState(DEFAULT_SITE_SETTINGS);
  const [pages, setPages] = useState([]);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
    try {
      const res = await adminUpdateSiteSettings(settings);
      if (res.data) {
        setSettings(res.data);
        if (res.data.appearance) {
          applyThemeVariables(res.data.appearance);
        }
      }
      // Push the freshly-saved settings (logo, header/footer, colors, ...) to
      // every mounted storefront component (Navbar, Footer, homepage) right
      // away — no server restart or hard browser refresh required.
      await refreshSiteSettings();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message || "Could not save settings. Please check the fields above and try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetAppearance = async () => {
    if (!window.confirm("Reset all appearance and theme colors to Aadya defaults?")) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await adminResetAppearanceSettings();
      if (res.data) {
        setSettings(res.data);
        if (res.data.appearance) {
          applyThemeVariables(res.data.appearance);
        }
      }
      await refreshSiteSettings();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message || "Could not reset appearance.");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading") return <LoadingNotice label="Loading store settings…" />;
  if (status === "error") return <ErrorNotice message={error || "Unable to load settings."} />;

  const tabs = [
    { id: "general", label: "General" },
    { id: "social", label: "Contact & Social" },
    { id: "header", label: "Header / Footer" },
    { id: "footer", label: "Footer Details" },
    { id: "checkout", label: "Commerce" },
    { id: "payments", label: "Payments" },
    { id: "shipping", label: "Shipping" },
    { id: "shop", label: "SEO / Shop" },
    { id: "branding", label: "Branding" },
    { id: "appearance", label: "Appearance" },
  ];

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__eyebrow">System</p>
          <h1 className="admin-page-header__title">Settings</h1>
          <p className="admin-page-header__desc">
            Store identity, commerce rules, and appearance — existing settings APIs only.
          </p>
        </div>
        <div className="admin-page-header__actions">
          <Button onClick={handleSave} disabled={saving} className="bg-terracotta text-white disabled:opacity-60">
            {saving ? "Saving…" : "Save All Settings"}
          </Button>
        </div>
      </div>

      {saved && (
        <div className="rounded-xl bg-sage-light px-4 py-3 text-xs font-semibold text-green-deep animate-fade-up">
          ✓ Store settings successfully saved &amp; applied to live storefront!
        </div>
      )}
      {error && <p className="text-xs font-semibold text-terracotta">{error}</p>}

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar border-b border-charcoal/10 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`admin-btn whitespace-nowrap ${
              activeTab === tab.id ? "admin-btn--accent" : "admin-btn--ghost"
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Address Line 1</label>
                <input
                  value={settings.general?.businessAddress || ""}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, general: { ...s.general, businessAddress: e.target.value } }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Address Line 2 (Optional)</label>
                <input
                  value={settings.general?.businessAddressLine2 || ""}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, general: { ...s.general, businessAddressLine2: e.target.value } }))
                  }
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
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
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">State</label>
                <input
                  value={settings.general?.state || ""}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, general: { ...s.general, state: e.target.value } }))
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
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Country</label>
                <input
                  value={settings.general?.country || ""}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, general: { ...s.general, country: e.target.value } }))
                  }
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">WhatsApp Number (Optional)</label>
              <input
                placeholder="+91XXXXXXXXXX"
                value={settings.general?.whatsappNumber || ""}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, general: { ...s.general, whatsappNumber: e.target.value } }))
                }
                className={inputCls}
              />
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
            <ImagePickerInput
              label="Desktop Store Logo"
              value={settings.branding?.desktopLogo}
              onChange={(url) =>
                setSettings((s) => ({ ...s, branding: { ...s.branding, desktopLogo: url } }))
              }
              pickerTitle="Select desktop logo"
              inputClassName={inputCls}
              enableCrop
              aspectOptions={["free", "wide", "square"]}
            />

            <ImagePickerInput
              label="Mobile Store Logo (Optional — falls back to desktop logo)"
              value={settings.branding?.mobileLogo}
              onChange={(url) =>
                setSettings((s) => ({ ...s, branding: { ...s.branding, mobileLogo: url } }))
              }
              pickerTitle="Select mobile logo"
              inputClassName={inputCls}
              enableCrop
              aspectOptions={["free", "wide", "square"]}
            />

            <ImagePickerInput
              label="Secondary / Light Logo (Optional — for dark backgrounds)"
              value={settings.branding?.secondaryLogo}
              onChange={(url) =>
                setSettings((s) => ({ ...s, branding: { ...s.branding, secondaryLogo: url } }))
              }
              pickerTitle="Select secondary logo"
              inputClassName={inputCls}
              enableCrop
              aspectOptions={["free", "wide", "square"]}
            />

            <ImagePickerInput
              label="Favicon"
              value={settings.branding?.favicon}
              onChange={(url) =>
                setSettings((s) => ({ ...s, branding: { ...s.branding, favicon: url } }))
              }
              pickerTitle="Select favicon"
              inputClassName={inputCls}
              enableCrop
              aspect={1}
            />

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
              <div />
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Logo Width Desktop (px)</label>
                <input
                  type="number"
                  min={40}
                  max={400}
                  value={settings.branding?.logoWidthDesktop || 140}
                  onChange={(e) => {
                    const clamped = Math.min(400, Math.max(40, Number(e.target.value) || 140));
                    setSettings((s) => ({ ...s, branding: { ...s.branding, logoWidthDesktop: clamped } }));
                  }}
                  className={inputCls}
                />
                <p className="mt-1 text-[11px] text-charcoal-soft">Constrained 40–400px so the header can't be broken.</p>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Logo Width Mobile (px)</label>
                <input
                  type="number"
                  min={30}
                  max={300}
                  value={settings.branding?.logoWidthMobile || 110}
                  onChange={(e) => {
                    const clamped = Math.min(300, Math.max(30, Number(e.target.value) || 110));
                    setSettings((s) => ({ ...s, branding: { ...s.branding, logoWidthMobile: clamped } }));
                  }}
                  className={inputCls}
                />
                <p className="mt-1 text-[11px] text-charcoal-soft">Constrained 30–300px so the mobile header can't be broken.</p>
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
            <ImagePickerInput
              label="Footer Logo (Optional — falls back to store logo)"
              value={settings.footer?.footerLogo}
              onChange={(url) =>
                setSettings((s) => ({ ...s, footer: { ...s.footer, footerLogo: url } }))
              }
              pickerTitle="Select footer logo"
              inputClassName={inputCls}
              enableCrop
              aspectOptions={["free", "wide", "square"]}
            />
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

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Social Links Heading</label>
              <input
                placeholder="Connect With Us"
                value={settings.footer?.socialHeading || ""}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, footer: { ...s.footer, socialHeading: e.target.value } }))
                }
                className={inputCls}
              />
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
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">LinkedIn URL</label>
                <input
                  placeholder="https://linkedin.com/..."
                  value={settings.social?.linkedin || ""}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, social: { ...s.social, linkedin: e.target.value } }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">WhatsApp Link (Optional)</label>
                <input
                  placeholder="https://wa.me/91XXXXXXXXXX"
                  value={settings.social?.whatsapp || ""}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, social: { ...s.social, whatsapp: e.target.value } }))
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
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-charcoal/15 px-4 py-2 text-xs sm:text-sm focus:border-terracotta focus:outline-none bg-white text-charcoal";
