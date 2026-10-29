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
import FooterSectionsEditor from "../../components/admin/FooterSectionsEditor";
import BrandLogo from "../../components/BrandLogo";
import { applyThemeVariables, DEFAULT_SITE_SETTINGS, refreshSiteSettings } from "../../hooks/useSiteSettings";

// Renders the logo exactly as <BrandLogo> renders it in the real Navbar
// (same width + max-height + object-fit:contain), so the admin sees the true
// navbar result instead of a raw, uncropped preview thumbnail.
function HeaderLogoPreview({ src, widthPx, heightPx, label }) {
  if (!src) return null;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-charcoal/15 bg-ivory-dark/30 px-4 py-3">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-charcoal-soft shrink-0">{label}</span>
      <div className="flex min-w-0 items-center overflow-x-auto rounded-lg border border-charcoal/10 bg-white px-3 py-2">
        <BrandLogo src={src} widthPx={widthPx} heightPx={heightPx} className="block" />
      </div>
    </div>
  );
}

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
    if (!window.confirm("Reset all appearance and theme colors to Tushaqsa defaults?")) return;
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
    { id: "header-cms", label: "Header & Nav CMS ➔" },
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
            <p className="text-xs text-charcoal-soft -mt-2">
              Use the <strong>Header Logo (5:1)</strong> crop preset to select just the main wordmark —
              not a tagline or the surrounding canvas whitespace — for the logos below. This is what
              renders in the navbar; the Footer Logo further down can keep the full tall/tagline version.
            </p>

            <ImagePickerInput
              label="Desktop Store Logo"
              value={settings.branding?.desktopLogo}
              onChange={(url) =>
                setSettings((s) => ({ ...s, branding: { ...s.branding, desktopLogo: url } }))
              }
              pickerTitle="Select desktop logo"
              inputClassName={inputCls}
              enableCrop
              aspect={5 / 1}
              aspectOptions={["header", "free", "wide", "square"]}
            />
            <HeaderLogoPreview
              src={settings.branding?.desktopLogo}
              widthPx={settings.branding?.logoWidthDesktop || 140}
              heightPx={settings.branding?.logoHeightDesktop}
              label="Desktop navbar preview"
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
              aspect={5 / 1}
              aspectOptions={["header", "free", "wide", "square"]}
            />
            <HeaderLogoPreview
              src={settings.branding?.mobileLogo || settings.branding?.desktopLogo}
              widthPx={settings.branding?.logoWidthMobile || 110}
              heightPx={settings.branding?.logoHeightMobile}
              label="Mobile navbar preview"
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
              aspect={5 / 1}
              aspectOptions={["header", "free", "wide", "square"]}
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
                  min={1}
                  step="any"
                  value={settings.branding?.logoWidthDesktop || ""}
                  placeholder="140"
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setSettings((s) => ({ ...s, branding: { ...s.branding, logoWidthDesktop: Number.isFinite(n) && n > 0 ? n : 140 } }));
                  }}
                  className={inputCls}
                />
                <p className="mt-1 text-[11px] text-charcoal-soft">Any size you like. Height follows automatically unless you set one.</p>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Logo Height Desktop (px)</label>
                <input
                  type="number"
                  min={1}
                  step="any"
                  value={settings.branding?.logoHeightDesktop || ""}
                  placeholder="Auto"
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setSettings((s) => ({ ...s, branding: { ...s.branding, logoHeightDesktop: Number.isFinite(n) && n > 0 ? n : 0 } }));
                  }}
                  className={inputCls}
                />
                <p className="mt-1 text-[11px] text-charcoal-soft">Leave empty for auto. Set both width and height to fix both; the logo is never cropped.</p>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Logo Width Mobile (px)</label>
                <input
                  type="number"
                  min={1}
                  step="any"
                  value={settings.branding?.logoWidthMobile || ""}
                  placeholder="110"
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setSettings((s) => ({ ...s, branding: { ...s.branding, logoWidthMobile: Number.isFinite(n) && n > 0 ? n : 110 } }));
                  }}
                  className={inputCls}
                />
                <p className="mt-1 text-[11px] text-charcoal-soft">Shrinks only if the phone screen is narrower than this.</p>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Logo Height Mobile (px)</label>
                <input
                  type="number"
                  min={1}
                  step="any"
                  value={settings.branding?.logoHeightMobile || ""}
                  placeholder="Auto"
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setSettings((s) => ({ ...s, branding: { ...s.branding, logoHeightMobile: Number.isFinite(n) && n > 0 ? n : 0 } }));
                  }}
                  className={inputCls}
                />
                <p className="mt-1 text-[11px] text-charcoal-soft">Leave empty for auto. The header grows to fit the logo.</p>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Footer Logo Width Desktop (px)</label>
                <input
                  type="number"
                  min={1}
                  step="any"
                  value={settings.footer?.footerLogoWidth || ""}
                  placeholder="Auto"
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setSettings((s) => ({ ...s, footer: { ...s.footer, footerLogoWidth: Number.isFinite(n) && n > 0 ? n : 0 } }));
                  }}
                  className={inputCls}
                />
                <p className="mt-1 text-[11px] text-charcoal-soft">Empty = auto (default 160). Set both width and height to fix both; never cropped.</p>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Footer Logo Height Desktop (px)</label>
                <input
                  type="number"
                  min={1}
                  step="any"
                  value={settings.footer?.footerLogoHeight || ""}
                  placeholder="Auto"
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setSettings((s) => ({ ...s, footer: { ...s.footer, footerLogoHeight: Number.isFinite(n) && n > 0 ? n : 0 } }));
                  }}
                  className={inputCls}
                />
                <p className="mt-1 text-[11px] text-charcoal-soft">Empty = auto from the width.</p>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Footer Logo Width Mobile (px)</label>
                <input
                  type="number"
                  min={1}
                  step="any"
                  value={settings.footer?.footerLogoWidthMobile || ""}
                  placeholder="Auto"
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setSettings((s) => ({ ...s, footer: { ...s.footer, footerLogoWidthMobile: Number.isFinite(n) && n > 0 ? n : 0 } }));
                  }}
                  className={inputCls}
                />
                <p className="mt-1 text-[11px] text-charcoal-soft">Empty = auto (default 130).</p>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Footer Logo Height Mobile (px)</label>
                <input
                  type="number"
                  min={1}
                  step="any"
                  value={settings.footer?.footerLogoHeightMobile || ""}
                  placeholder="Auto"
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setSettings((s) => ({ ...s, footer: { ...s.footer, footerLogoHeightMobile: Number.isFinite(n) && n > 0 ? n : 0 } }));
                  }}
                  className={inputCls}
                />
                <p className="mt-1 text-[11px] text-charcoal-soft">Empty = auto from the width.</p>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Footer Logo Style (footer is dark)</label>
                <select
                  value={settings.footer?.footerLogoStyle === "WHITE_SILHOUETTE" ? "WHITE_SILHOUETTE" : "ORIGINAL"}
                  onChange={(e) => setSettings((s) => ({ ...s, footer: { ...s.footer, footerLogoStyle: e.target.value } }))}
                  className={inputCls}
                >
                  <option value="ORIGINAL">Original colours (transparent logo, no background box)</option>
                  <option value="WHITE_SILHOUETTE">White silhouette (single-colour logo)</option>
                </select>
              </div>
              <div className="col-span-2 flex flex-wrap items-center gap-3 rounded-xl bg-charcoal px-4 py-4" data-testid="footer-logo-preview">
                <span className="w-full text-[10px] font-semibold uppercase tracking-wider text-white/70">Footer preview (dark background)</span>
                <span className="inline-flex max-w-full">
                  {(settings.footer?.footerLogo || settings.branding?.secondaryLogo || settings.branding?.desktopLogo) ? <BrandLogo
                    src={settings.footer?.footerLogo || settings.branding?.secondaryLogo || settings.branding?.desktopLogo}
                    widthPx={Number(settings.footer?.footerLogoWidth) || (Number(settings.footer?.footerLogoHeight) ? undefined : 160)}
                    heightPx={Number(settings.footer?.footerLogoHeight) || undefined}
                    className={`block ${settings.footer?.footerLogoStyle === "WHITE_SILHOUETTE" ? "brightness-0 invert" : ""}`}
                    textClassName="font-serif-display text-3xl font-bold text-white"
                  /> : <span className="text-xs text-white/60">No logo selected</span>}
                </span>
              </div>
            </div>
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

            <FooterSectionsEditor
              footer={settings.footer || {}}
              pages={pages}
              onChange={(patch) => setSettings((s) => ({ ...s, footer: { ...s.footer, ...patch } }))}
            />
          </div>
        )}

        {/* TAB 5: APPEARANCE */}
        {activeTab === "appearance" && (
          <div className="space-y-6 rounded-2xl border border-charcoal/10 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-charcoal/10 pb-4">
              <h2 className="font-serif text-lg font-bold text-charcoal">Theme &amp; Appearance Colors</h2>
              <Button type="button" onClick={handleResetAppearance} className="bg-charcoal/10 text-charcoal hover:bg-terracotta hover:text-white text-xs">
                Reset to Tushaqsa Defaults
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
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Dispatch Estimate</label>
                <input
                  type="text"
                  value={settings.shipping?.dispatchEstimate ?? ""}
                  onChange={(e) => setSettings((s) => ({ ...s, shipping: { ...s.shipping, dispatchEstimate: e.target.value } }))}
                  placeholder="1-2 business days"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Delivery Estimate</label>
                <input
                  type="text"
                  value={settings.shipping?.deliveryEstimate ?? ""}
                  onChange={(e) => setSettings((s) => ({ ...s, shipping: { ...s.shipping, deliveryEstimate: e.target.value } }))}
                  placeholder="3-7 business days"
                  className={inputCls}
                />
              </div>
            </div>

            <h2 className="pt-4 font-serif text-lg font-bold text-charcoal">Return Policy &amp; Tax Display</h2>
            <div className="grid grid-cols-2 gap-4" data-testid="return-policy-settings">
              <label className="col-span-2 flex items-center gap-2 text-sm font-semibold text-charcoal cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.returns?.enabled !== false}
                  onChange={(e) => setSettings((s) => ({ ...s, returns: { ...s.returns, enabled: e.target.checked } }))}
                />
                Accept return requests
              </label>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Return Window (days after delivery)</label>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={settings.returns?.windowDays ?? 7}
                  onChange={(e) => setSettings((s) => ({ ...s, returns: { ...s.returns, windowDays: Math.max(0, Math.min(365, Math.round(Number(e.target.value) || 0))) } }))}
                  className={inputCls}
                />
              </div>
              <label className="flex items-center gap-2 self-end text-sm font-semibold text-charcoal cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.checkout?.pricesIncludeTax !== false}
                  onChange={(e) => setSettings((s) => ({ ...s, checkout: { ...s.checkout, pricesIncludeTax: e.target.checked } }))}
                />
                Prices shown include tax (cart note: “Taxes included”)
              </label>
            </div>
            <p className="text-[11px] leading-relaxed text-charcoal-soft">
              The return window is the real window the store enforces for return requests. In the utility bar, ticker, promos, FAQs and the About / Shipping / Returns pages you can write
              {" "}<code>{"{freeShippingThreshold}"}</code>, <code>{"{standardShippingAmount}"}</code>, <code>{"{returnWindowDays}"}</code>, <code>{"{dispatchEstimate}"}</code>, <code>{"{deliveryEstimate}"}</code>
              {" "}or <code>{"{storeName}"}</code> and the live value is filled in, so messaging always matches these settings.
            </p>
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
                  checked={settings.payments?.cashfreeEnabled !== false}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      payments: { ...s.payments, cashfreeEnabled: e.target.checked },
                    }))
                  }
                />
                Enable Online Payment (Cashfree)
              </label>
              <input
                placeholder="Online payment option label, e.g. Pay Online (UPI, Cards, NetBanking)"
                value={settings.payments?.cashfreeDisplayLabel || ""}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    payments: { ...s.payments, cashfreeDisplayLabel: e.target.value },
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
