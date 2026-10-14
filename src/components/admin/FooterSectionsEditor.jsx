import React from "react";
import ImagePickerInput from "./ImagePickerInput";
import FooterColumnsEditor from "./FooterColumnsEditor";
import { footerUrlError } from "../../lib/footerUrls";
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
    </div>
  );
}
