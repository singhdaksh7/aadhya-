import React, { useState } from "react";
import ImagePickerInput from "./ImagePickerInput";
import FooterColumnsEditor from "./FooterColumnsEditor";
import { footerUrlError } from "../../lib/footerUrls";
import { resolveMediaUrl } from "../../lib/api";
import { fInputCls, fLabelCls, newId, renumber, moveItem, FieldError, RowControls, SectionCard, AddButton } from "./FooterEditorBits";

const MAX_COMPANY_LINES = 10;
const MAX_CONTACT_ITEMS = 12;
const MAX_SEO_SECTIONS = 12;
const MAX_SEO_LINKS = 40;
const MAX_BADGES = 12;

function CompanyBlockEditor({ block, onChange }) {
  const b = block || {};
  const lines = Array.isArray(b.lines) ? b.lines : [];
  const set = (patch) => onChange({ enabled: b.enabled === true, heading: "", lines: [], ...b, ...patch });
  return (
    <SectionCard title="Company Block" hint="Plain text shown under the brand description (e.g. “Manufactured & Marketed By” plus name and address lines).">
      <label className="flex items-center gap-2 text-xs font-medium text-charcoal cursor-pointer">
        <input type="checkbox" checked={b.enabled === true} onChange={(e) => set({ enabled: e.target.checked })} />
        Show company block
      </label>
      <div>
        <label className={fLabelCls}>Heading</label>
        <input aria-label="Company block heading" className={fInputCls} maxLength={100} value={b.heading || ""} onChange={(e) => set({ heading: e.target.value })} />
      </div>
      {lines.map((line, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <input
            aria-label={`Company line ${i + 1}`}
            className={`${fInputCls} min-w-[10rem] flex-1`}
            maxLength={200}
            value={line}
            onChange={(e) => set({ lines: lines.map((l, k) => (k === i ? e.target.value : l)) })}
          />
          <RowControls
            name={`company line ${i + 1}`}
            index={i}
            total={lines.length}
            onMove={(d) => set({ lines: moveItem(lines, i, d) })}
            onDelete={() => set({ lines: lines.filter((_, k) => k !== i) })}
          />
        </div>
      ))}
      <AddButton disabled={lines.length >= MAX_COMPANY_LINES} onClick={() => set({ lines: [...lines, ""] })}>
        + Add line
      </AddButton>
    </SectionCard>
  );
}

function ContactItemsEditor({ items, onChange }) {
  const list = Array.isArray(items) ? items : [];
  const setItem = (i, patch) => onChange(list.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  return (
    <SectionCard
      title="Contact Rows"
      hint="Shown in a “Contact” block. Link accepts /path, https://, tel: or mailto:. Existing store contact details are unchanged."
      action={
        <AddButton
          disabled={list.length >= MAX_CONTACT_ITEMS}
          onClick={() => onChange(renumber([...list, { id: newId("ci"), enabled: true, label: "", value: "", url: "" }]))}
        >
          + Add contact row
        </AddButton>
      }
    >
      {list.map((it, i) => (
        <div key={it.id || i} className="flex flex-wrap items-start gap-2" data-testid="footer-contact-editor">
          <input aria-label={`Contact ${i + 1} label`} placeholder="Label (e.g. WhatsApp)" maxLength={60} className={`${fInputCls} sm:w-36 sm:flex-none`} value={it.label || ""} onChange={(e) => setItem(i, { label: e.target.value })} />
          <input aria-label={`Contact ${i + 1} value`} placeholder="Value" maxLength={200} className={`${fInputCls} sm:w-44 sm:flex-none`} value={it.value || ""} onChange={(e) => setItem(i, { value: e.target.value })} />
          <div className="min-w-[10rem] flex-1">
            <input aria-label={`Contact ${i + 1} link`} placeholder="Link (optional): tel:+... mailto:... https://..." maxLength={500} className={fInputCls} value={it.url || ""} onChange={(e) => setItem(i, { url: e.target.value })} />
            <FieldError message={footerUrlError(it.url, { allowTelMailto: true })} />
          </div>
          <RowControls
            name={`contact ${i + 1}`}
            index={i}
            total={list.length}
            enabled={it.enabled}
            onMove={(d) => onChange(renumber(moveItem(list, i, d)))}
            onToggle={(v) => setItem(i, { enabled: v })}
            onDelete={() => onChange(renumber(list.filter((_, k) => k !== i)))}
          />
        </div>
      ))}
    </SectionCard>
  );
}

function SeoSectionsEditor({ sections, onChange }) {
  const list = Array.isArray(sections) ? sections : [];
  const setSec = (i, patch) => onChange(list.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  return (
    <SectionCard
      title="SEO / Keyword Link Bands"
      hint="Shown between the footer columns and the bottom bar: heading, optional paragraph, then links separated by “ | ”."
      action={
        <AddButton
          disabled={list.length >= MAX_SEO_SECTIONS}
          onClick={() => onChange(renumber([...list, { id: newId("seo"), enabled: true, heading: "", text: "", links: [] }]))}
        >
          + Add section
        </AddButton>
      }
    >
      {list.map((s, i) => {
        const links = Array.isArray(s.links) ? s.links : [];
        const setLinks = (next) => setSec(i, { links: next });
        return (
          <div key={s.id || i} className="space-y-2 rounded-lg border border-charcoal/10 bg-white p-3" data-testid="footer-seo-editor">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[10rem] flex-1">
                <label className={fLabelCls}>Heading</label>
                <input aria-label={`SEO section ${i + 1} heading`} className={fInputCls} maxLength={100} value={s.heading || ""} onChange={(e) => setSec(i, { heading: e.target.value })} />
              </div>
              <RowControls
                name={`SEO section ${i + 1}`}
                index={i}
                total={list.length}
                enabled={s.enabled}
                onMove={(d) => onChange(renumber(moveItem(list, i, d)))}
                onToggle={(v) => setSec(i, { enabled: v })}
                onDelete={() => onChange(renumber(list.filter((_, k) => k !== i)))}
              />
            </div>
            <div>
              <label className={fLabelCls}>Paragraph (optional, plain text, max 2000)</label>
              <textarea aria-label={`SEO section ${i + 1} text`} rows={2} maxLength={2000} className={fInputCls} value={s.text || ""} onChange={(e) => setSec(i, { text: e.target.value })} />
            </div>
            {links.map((l, j) => (
              <div key={j} className="flex flex-wrap items-start gap-2">
                <input aria-label={`SEO section ${i + 1} link ${j + 1} label`} placeholder="Label" maxLength={100} className={`${fInputCls} sm:w-44 sm:flex-none`} value={l.label || ""} onChange={(e) => setLinks(links.map((x, k) => (k === j ? { ...x, label: e.target.value } : x)))} />
                <div className="min-w-[10rem] flex-1">
                  <input aria-label={`SEO section ${i + 1} link ${j + 1} url`} placeholder="/page or https://..." maxLength={500} className={fInputCls} value={l.url || ""} onChange={(e) => setLinks(links.map((x, k) => (k === j ? { ...x, url: e.target.value } : x)))} />
                  <FieldError message={footerUrlError(l.url)} />
                </div>
                <RowControls
                  name={`SEO section ${i + 1} link ${j + 1}`}
                  index={j}
                  total={links.length}
                  onMove={(d) => setLinks(moveItem(links, j, d))}
                  onDelete={() => setLinks(links.filter((_, k) => k !== j))}
                />
              </div>
            ))}
            <AddButton disabled={links.length >= MAX_SEO_LINKS} onClick={() => setLinks([...links, { label: "", url: "" }])}>
              + Add link
            </AddButton>
          </div>
        );
      })}
    </SectionCard>
  );
}

function PaymentBadgesEditor({ badges, onChange }) {
  const list = Array.isArray(badges) ? badges : [];
  const setB = (i, patch) => onChange(list.map((b, k) => (k === i ? { ...b, ...patch } : b)));
  return (
    <SectionCard
      title="Payment Badges"
      hint="Small logos from the Media Library. When none have an image, the text payment labels are shown instead."
      action={
        <AddButton disabled={list.length >= MAX_BADGES} onClick={() => onChange([...list, { id: newId("pb"), label: "", image: "" }])}>
          + Add badge
        </AddButton>
      }
    >
      {list.map((b, i) => (
        <div key={b.id || i} className="space-y-2 rounded-lg border border-charcoal/10 bg-white p-3" data-testid="footer-badge-editor">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[10rem] flex-1">
              <label className={fLabelCls}>Label (alt text)</label>
              <input aria-label={`Badge ${i + 1} label`} className={fInputCls} maxLength={60} value={b.label || ""} onChange={(e) => setB(i, { label: e.target.value })} />
            </div>
            <RowControls
              name={`badge ${i + 1}`}
              index={i}
              total={list.length}
              onMove={(d) => onChange(moveItem(list, i, d))}
              onDelete={() => onChange(list.filter((_, k) => k !== i))}
            />
          </div>
          <ImagePickerInput label="Badge image" value={b.image} onChange={(url) => setB(i, { image: url })} pickerTitle="Select payment badge" inputClassName={fInputCls} />
        </div>
      ))}
    </SectionCard>
  );
}

function FooterImageEditor({ image, onChange }) {
  const img = image || {};
  const set = (patch) => onChange({ ...img, ...patch });
  const width = img.maxWidth;
  const widthErr = width !== undefined && width !== "" && (width < 40 || width > 1200) ? "Max width must be between 40 and 1200 px" : "";
  return (
    <SectionCard title="Footer Image" hint="Optional image (banner, certification, artwork). Hidden until enabled with an image.">
      <label className="flex items-center gap-2 text-xs font-medium text-charcoal cursor-pointer">
        <input type="checkbox" checked={img.enabled === true} onChange={(e) => set({ enabled: e.target.checked })} />
        Show footer image
      </label>
      <ImagePickerInput label="Image" value={img.image} onChange={(url) => set({ image: url })} pickerTitle="Select footer image" inputClassName={fInputCls} />
      <div>
        <label className={fLabelCls}>Alt text</label>
        <input aria-label="Footer image alt text" className={fInputCls} maxLength={240} value={img.alt || ""} onChange={(e) => set({ alt: e.target.value })} />
      </div>
      <div>
        <label className={fLabelCls}>Link (optional)</label>
        <input aria-label="Footer image link" placeholder="/page or https://..." maxLength={500} className={fInputCls} value={img.linkUrl || ""} onChange={(e) => set({ linkUrl: e.target.value })} />
        <FieldError message={footerUrlError(img.linkUrl)} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={fLabelCls}>Placement</label>
          <select aria-label="Footer image placement" className={fInputCls} value={img.placement || "BRAND"} onChange={(e) => set({ placement: e.target.value })}>
            <option value="TOP">Top banner (above columns)</option>
            <option value="BRAND">Brand column</option>
            <option value="BOTTOM">Bottom band (above copyright)</option>
          </select>
        </div>
        <div>
          <label className={fLabelCls}>Max width (px)</label>
          <input
            aria-label="Footer image max width"
            type="number"
            min={40}
            max={1200}
            placeholder="400"
            className={fInputCls}
            value={width ?? ""}
            onChange={(e) => set({ maxWidth: e.target.value === "" ? undefined : Number(e.target.value) })}
          />
          <FieldError message={widthErr} />
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-xs font-medium text-charcoal cursor-pointer">
          <input type="checkbox" checked={img.showOnMobile !== false} onChange={(e) => set({ showOnMobile: e.target.checked })} />
          Show on mobile
        </label>
      </div>
    </SectionCard>
  );
}

function FooterArtworkEditor({ artwork, onChange }) {
  const art = artwork || {};
  const set = (patch) => onChange({ ...art, ...patch });
  const [previewDevice, setPreviewDevice] = useState("desktop");

  const desktopHeight = art.desktopHeight ?? 340;
  const tabletHeight = art.tabletHeight ?? 280;
  const mobileHeight = art.mobileHeight ?? 220;
  const fit = art.fit || "cover";
  const posX = art.positionX ?? 50;
  const posY = art.positionY ?? 50;
  const offX = art.offsetX ?? 0;
  const offY = art.offsetY ?? 0;
  const topSpacing = art.topSpacing ?? 0;

  const currentPreviewHeight =
    fit === "natural"
      ? "auto"
      : previewDevice === "mobile"
      ? `${mobileHeight}px`
      : previewDevice === "tablet"
      ? `${tabletHeight}px`
      : `${desktopHeight}px`;

  const previewWidth =
    previewDevice === "mobile" ? "max-w-[390px]" : previewDevice === "tablet" ? "max-w-[768px]" : "w-full";

  const previewImage = previewDevice === "mobile" && art.mobileImage ? art.mobileImage : art.desktopImage || art.mobileImage;

  const handlePresetChange = (preset) => {
    if (preset === "center") set({ positionPreset: preset, positionX: 50, positionY: 50 });
    else if (preset === "top") set({ positionPreset: preset, positionX: 50, positionY: 0 });
    else if (preset === "bottom") set({ positionPreset: preset, positionX: 50, positionY: 100 });
    else if (preset === "left") set({ positionPreset: preset, positionX: 0, positionY: 50 });
    else if (preset === "right") set({ positionPreset: preset, positionX: 100, positionY: 50 });
    else set({ positionPreset: "custom" });
  };

  const numVal = (v) => (v === "" || v === undefined || v === null ? undefined : Number(v));

  return (
    <SectionCard
      title="Footer Artwork"
      hint="Full-width decorative artwork displayed at the very bottom of the footer, seamless with the page bottom. Features non-destructive focal cropping, responsive heights, and natural height modes."
    >
      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 text-xs font-semibold text-charcoal cursor-pointer">
          <input
            type="checkbox"
            aria-label="Enable Footer Artwork"
            checked={art.enabled === true}
            onChange={(e) => set({ enabled: e.target.checked })}
          />
          Enable Footer Artwork
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-charcoal cursor-pointer">
          <input
            type="checkbox"
            aria-label="Decorative Artwork"
            checked={art.isDecorative === true}
            onChange={(e) => set({ isDecorative: e.target.checked })}
          />
          Decorative Artwork (hide from screen readers / empty alt)
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ImagePickerInput
          label="Desktop Image"
          value={art.desktopImage || ""}
          onChange={(url) => set({ desktopImage: url })}
          pickerTitle="Select Desktop Footer Artwork"
          inputClassName={fInputCls}
        />
        <ImagePickerInput
          label="Mobile Image (Optional — falls back to desktop)"
          value={art.mobileImage || ""}
          onChange={(url) => set({ mobileImage: url })}
          pickerTitle="Select Mobile Footer Artwork"
          inputClassName={fInputCls}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className={fLabelCls}>Alt Text {art.isDecorative && "(Ignored in Decorative mode)"}</label>
          <input
            aria-label="Footer artwork alt text"
            className={fInputCls}
            maxLength={240}
            disabled={art.isDecorative === true}
            placeholder={art.isDecorative ? "Decorative (empty alt)" : "Describe the artwork"}
            value={art.alt || ""}
            onChange={(e) => set({ alt: e.target.value })}
          />
        </div>
        <div>
          <label className={fLabelCls}>Optional Link URL</label>
          <input
            aria-label="Footer artwork link"
            placeholder="/collections/artisan or https://..."
            maxLength={500}
            className={fInputCls}
            value={art.linkUrl || ""}
            onChange={(e) => set({ linkUrl: e.target.value })}
          />
          <FieldError message={footerUrlError(art.linkUrl)} />
          <label className="mt-1.5 flex items-center gap-2 text-[11px] font-medium text-charcoal-soft cursor-pointer">
            <input
              type="checkbox"
              aria-label="Open artwork link in new tab"
              checked={art.openInNewTab === true}
              onChange={(e) => set({ openInNewTab: e.target.checked })}
            />
            Open link in new tab
          </label>
        </div>
      </div>

      {/* Layout & Fit */}
      <div className="rounded-xl border border-charcoal/10 bg-ivory/30 p-4 space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-charcoal">Layout &amp; Sizing</h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="footer-artwork-fit" className={fLabelCls}>Display Mode / Image Fit</label>
            <select
              id="footer-artwork-fit"
              aria-label="Footer artwork fit mode"
              className={fInputCls}
              value={fit}
              onChange={(e) => set({ fit: e.target.value })}
            >
              <option value="cover">Cover (Fixed height, crops overflow)</option>
              <option value="contain">Contain (Full artwork visible, background color behind)</option>
              <option value="natural">Natural / Auto Height (Original aspect ratio)</option>
            </select>
          </div>
          <div>
            <label htmlFor="footer-artwork-max-height" className={fLabelCls}>Max Height (px)</label>
            <input
              id="footer-artwork-max-height"
              aria-label="Footer artwork max height"
              type="number"
              min={0}
              max={2000}
              placeholder="e.g. 600"
              className={fInputCls}
              value={art.maxHeight ?? ""}
              onChange={(e) => set({ maxHeight: numVal(e.target.value) })}
            />
          </div>
          <div>
            <label htmlFor="footer-artwork-min-height" className={fLabelCls}>Min Height (px)</label>
            <input
              id="footer-artwork-min-height"
              aria-label="Footer artwork min height"
              type="number"
              min={0}
              max={1200}
              placeholder="e.g. 120"
              className={fInputCls}
              value={art.minHeight ?? ""}
              onChange={(e) => set({ minHeight: numVal(e.target.value) })}
            />
          </div>
        </div>

        {fit !== "natural" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-1">
            <div>
              <label htmlFor="footer-artwork-desktop-height" className={fLabelCls}>Desktop Height (px)</label>
              <input
                id="footer-artwork-desktop-height"
                aria-label="Footer artwork desktop height"
                type="number"
                min={40}
                max={1200}
                placeholder="340"
                className={fInputCls}
                value={art.desktopHeight ?? ""}
                onChange={(e) => set({ desktopHeight: numVal(e.target.value) })}
              />
            </div>
            <div>
              <label htmlFor="footer-artwork-tablet-height" className={fLabelCls}>Tablet Height (px)</label>
              <input
                id="footer-artwork-tablet-height"
                aria-label="Footer artwork tablet height"
                type="number"
                min={40}
                max={1000}
                placeholder="280"
                className={fInputCls}
                value={art.tabletHeight ?? ""}
                onChange={(e) => set({ tabletHeight: numVal(e.target.value) })}
              />
            </div>
            <div>
              <label htmlFor="footer-artwork-mobile-height" className={fLabelCls}>Mobile Height (px)</label>
              <input
                id="footer-artwork-mobile-height"
                aria-label="Footer artwork mobile height"
                type="number"
                min={40}
                max={800}
                placeholder="220"
                className={fInputCls}
                value={art.mobileHeight ?? ""}
                onChange={(e) => set({ mobileHeight: numVal(e.target.value) })}
              />
            </div>
          </div>
        )}
      </div>

      {/* Crop, Position & Offset */}
      <div className="rounded-xl border border-charcoal/10 bg-ivory/30 p-4 space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-charcoal">Focal Point &amp; Visual Offset</h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="footer-artwork-position-preset" className={fLabelCls}>Position Preset</label>
            <select
              id="footer-artwork-position-preset"
              aria-label="Footer artwork position preset"
              className={fInputCls}
              value={art.positionPreset || "center"}
              onChange={(e) => handlePresetChange(e.target.value)}
            >
              <option value="center">Center (50% 50%)</option>
              <option value="top">Top (50% 0%)</option>
              <option value="bottom">Bottom (50% 100%)</option>
              <option value="left">Left (0% 50%)</option>
              <option value="right">Right (100% 50%)</option>
              <option value="custom">Custom Focal Point</option>
            </select>
          </div>
          <div>
            <label htmlFor="footer-artwork-position-x" className={fLabelCls}>Focal X Position (% 0-100)</label>
            <input
              id="footer-artwork-position-x"
              aria-label="Footer artwork position X"
              type="number"
              min={0}
              max={100}
              placeholder="50"
              className={fInputCls}
              value={art.positionX ?? ""}
              onChange={(e) => set({ positionX: numVal(e.target.value), positionPreset: "custom" })}
            />
          </div>
          <div>
            <label htmlFor="footer-artwork-position-y" className={fLabelCls}>Focal Y Position (% 0-100)</label>
            <input
              id="footer-artwork-position-y"
              aria-label="Footer artwork position Y"
              type="number"
              min={0}
              max={100}
              placeholder="50"
              className={fInputCls}
              value={art.positionY ?? ""}
              onChange={(e) => set({ positionY: numVal(e.target.value), positionPreset: "custom" })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 pt-1">
          <div>
            <label htmlFor="footer-artwork-offset-x" className={fLabelCls}>Offset X (-20 to +20 px)</label>
            <input
              id="footer-artwork-offset-x"
              aria-label="Footer artwork offset X"
              type="number"
              min={-20}
              max={20}
              placeholder="0"
              className={fInputCls}
              value={art.offsetX ?? ""}
              onChange={(e) => set({ offsetX: numVal(e.target.value) })}
            />
          </div>
          <div>
            <label htmlFor="footer-artwork-offset-y" className={fLabelCls}>Offset Y (-20 to +20 px)</label>
            <input
              id="footer-artwork-offset-y"
              aria-label="Footer artwork offset Y"
              type="number"
              min={-20}
              max={20}
              placeholder="0"
              className={fInputCls}
              value={art.offsetY ?? ""}
              onChange={(e) => set({ offsetY: numVal(e.target.value) })}
            />
          </div>
          <div>
            <label htmlFor="footer-artwork-top-spacing" className={fLabelCls}>Top Spacing / Overlap (-40 to +40 px)</label>
            <input
              id="footer-artwork-top-spacing"
              aria-label="Footer artwork top spacing"
              type="number"
              min={-40}
              max={40}
              placeholder="0"
              className={fInputCls}
              value={art.topSpacing ?? ""}
              onChange={(e) => set({ topSpacing: numVal(e.target.value) })}
            />
          </div>
          <div>
            <label htmlFor="footer-artwork-bg-color" className={fLabelCls}>Background Color (optional)</label>
            <input
              id="footer-artwork-bg-color"
              aria-label="Footer artwork background color"
              placeholder="#2B2723 or blank"
              maxLength={50}
              className={fInputCls}
              value={art.backgroundColor || ""}
              onChange={(e) => set({ backgroundColor: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Interactive Live Preview */}
      {previewImage && (
        <div className="space-y-2 rounded-xl border border-charcoal/15 bg-charcoal p-4 text-white" data-testid="footer-artwork-preview">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-ivory">Artwork Live Preview</span>
              <span className="ml-2 text-[11px] text-white/60">
                Mode: {fit.toUpperCase()} • Focal: {posX}% {posY}% • Height: {currentPreviewHeight}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[11px] text-white/50 mr-1">Viewport:</span>
              <button
                type="button"
                onClick={() => setPreviewDevice("desktop")}
                className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                  previewDevice === "desktop" ? "bg-terracotta text-white" : "bg-white/10 text-white/80 hover:bg-white/20"
                }`}
              >
                Desktop
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice("tablet")}
                className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                  previewDevice === "tablet" ? "bg-terracotta text-white" : "bg-white/10 text-white/80 hover:bg-white/20"
                }`}
              >
                Tablet
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice("mobile")}
                className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                  previewDevice === "mobile" ? "bg-terracotta text-white" : "bg-white/10 text-white/80 hover:bg-white/20"
                }`}
              >
                Mobile (390)
              </button>
            </div>
          </div>

          <div className="flex justify-center overflow-x-auto py-2">
            <div
              className={`relative overflow-hidden transition-all duration-300 ${previewWidth}`}
              style={{
                height: currentPreviewHeight,
                backgroundColor: art.backgroundColor || "#2B2723",
                marginTop: topSpacing ? `${topSpacing}px` : undefined,
                maxHeight: art.maxHeight ? `${art.maxHeight}px` : fit === "natural" ? "600px" : undefined,
                minHeight: art.minHeight ? `${art.minHeight}px` : undefined,
              }}
            >
              <img
                src={resolveMediaUrl(previewImage)}
                alt="Preview"
                className={`w-full block ${fit === "natural" ? "h-auto" : "h-full"}`}
                style={{
                  objectFit: fit === "cover" ? "cover" : "contain",
                  objectPosition: `${posX}% ${posY}%`,
                  transform: offX || offY ? `translate3d(${offX}px, ${offY}px, 0)` : undefined,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

/** All the optional, additive footer sections. `footer` is settings.footer; `onChange(patch)` merges keys into it. */
export default function FooterSectionsEditor({ footer = {}, onChange, pages = [] }) {
  return (
    <div className="space-y-4" data-testid="footer-sections-editor">
      <CompanyBlockEditor block={footer.companyBlock} onChange={(v) => onChange({ companyBlock: v })} />
      <ContactItemsEditor items={footer.contactItems} onChange={(v) => onChange({ contactItems: v })} />
      <FooterColumnsEditor columns={footer.footerColumns} pages={pages} onChange={(v) => onChange({ footerColumns: v })} />
      <SeoSectionsEditor sections={footer.seoSections} onChange={(v) => onChange({ seoSections: v })} />
      <PaymentBadgesEditor badges={footer.paymentBadges} onChange={(v) => onChange({ paymentBadges: v })} />
      <FooterImageEditor image={footer.image} onChange={(v) => onChange({ image: v })} />
      <FooterArtworkEditor artwork={footer.artwork} onChange={(v) => onChange({ artwork: v })} />
    </div>
  );
}
