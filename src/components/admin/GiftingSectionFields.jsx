import React from "react";
import ImagePickerInput from "./ImagePickerInput";
import { DEFAULT_GIFTING_CONTENT } from "../../lib/defaultGiftingContent";

const SELECT_CLS = "mt-1 w-full rounded-xl border border-charcoal/20 px-3 py-2 text-sm";
const INPUT_CLS = "mt-1 w-full rounded-xl border border-charcoal/20 px-3 py-2 text-sm";
const TEXTAREA_CLS = "mt-1 w-full rounded-xl border border-charcoal/20 p-3 text-sm";

const Toggle = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-2 text-xs font-semibold text-charcoal">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
  </label>
);

const newId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

/** Moves list[index] by `delta` and renumbers sortOrder so the storefront order matches the editor order. */
export function moveListItem(list, index, delta) {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next.map((item, i) => ({ ...item, sortOrder: i + 1 }));
}

/** Parses a number input value: "" -> null (unset), otherwise a finite non-negative number. */
export function parsePriceInput(raw) {
  if (raw === "" || raw === null || raw === undefined) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const TextField = ({ label, value, onChange, placeholder, type = "text" }) => (
  <label className="block text-xs font-semibold text-charcoal-soft">
    {label}
    <input type={type} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={INPUT_CLS} />
  </label>
);

const ImageField = ({ label = "Image", value, onChange }) => (
  <div>
    <span className="block text-xs font-semibold text-charcoal-soft mb-1">{label}</span>
    <ImagePickerInput value={value || ""} onChange={onChange} />
  </div>
);

/**
 * Generic add / edit / delete / reorder / enable-disable list editor.
 * `renderItem(item, update)` renders the type specific fields for one entry.
 */
function ListEditor({ title, addLabel, itemLabel, items, onChange, makeItem, renderItem }) {
  const update = (index, patch) => onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  return (
    <div className="pt-2">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-charcoal">{title} ({items.length})</span>
        <button type="button" onClick={() => onChange([...items, { ...makeItem(), id: newId(), sortOrder: items.length + 1, enabled: true }])} className="text-xs font-semibold store-primary hover:underline">
          + {addLabel}
        </button>
      </div>
      <div className="space-y-3">
        {items.map((it, idx) => (
          <div key={it.id || idx} className="p-3 border border-charcoal/15 rounded-xl space-y-3 bg-charcoal/5" data-testid={`gifting-item-${idx}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-charcoal">{itemLabel} #{idx + 1}</span>
              <div className="flex items-center gap-3">
                <Toggle label="Enabled" checked={it.enabled !== false} onChange={(v) => update(idx, { enabled: v })} />
                <button type="button" aria-label={`Move ${itemLabel} ${idx + 1} up`} disabled={idx === 0} onClick={() => onChange(moveListItem(items, idx, -1))} className="text-xs disabled:opacity-30">▲</button>
                <button type="button" aria-label={`Move ${itemLabel} ${idx + 1} down`} disabled={idx === items.length - 1} onClick={() => onChange(moveListItem(items, idx, 1))} className="text-xs disabled:opacity-30">▼</button>
                <button type="button" onClick={() => onChange(items.filter((_, i) => i !== idx))} className="text-xs text-red-600 hover:underline">
                  Remove
                </button>
              </div>
            </div>
            {renderItem(it, (patch) => update(idx, patch))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Shows the live default (what the storefront renders today) until an admin overrides it. */
const labelValue = (value, type, key) => (typeof value[key] === "string" ? value[key] : DEFAULT_GIFTING_CONTENT[type]?.[key] ?? "");

const SectionHeading = ({ value, set, type, subtitle = true, headingLabel = "Section Heading", eyebrow = true }) => (
  <>
    {eyebrow && (
      <TextField label="Eyebrow (small label above the heading, leave blank to hide)" value={labelValue(value, type, "eyebrow")} onChange={(v) => set("eyebrow", v)} />
    )}
    <TextField label={headingLabel} value={value.heading} onChange={(v) => set("heading", v)} />
    {subtitle && <TextField label="Subtitle" value={value.subtitle} onChange={(v) => set("subtitle", v)} />}
  </>
);

const BENEFIT_ICONS = [
  ["gift", "Gift"],
  ["heart", "Heart"],
  ["truck", "Truck"],
  ["sparkles", "Sparkles (default)"],
];

const STORY_LAYOUTS = [
  ["AUTO", "Auto (alternate image side)"],
  ["IMAGE_LEFT", "Image left, text right"],
  ["IMAGE_RIGHT", "Image right, text left"],
  ["IMAGE_TOP", "Image on top, text below"],
];

const QUERY_SORTS = [
  ["newest", "Newest first"],
  ["price_asc", "Price: low to high"],
  ["price_desc", "Price: high to low"],
  ["name_asc", "Name A-Z"],
];

export default function GiftingSectionFields({ type, value = {}, onChange, products = [], collections = [], categories = [] }) {
  const set = (key, val) => onChange({ ...value, [key]: val });

  switch (type) {
    case "GIFTING_HERO":
      return (
        <div className="space-y-4">
          <TextField label="Eyebrow" value={value.eyebrow} onChange={(v) => set("eyebrow", v)} />
          <TextField label="Hero Title" value={value.title} onChange={(v) => set("title", v)} />
          <label className="block text-xs font-semibold text-charcoal-soft">
            Description
            <textarea rows="3" value={value.description || ""} onChange={(e) => set("description", e.target.value)} className={TEXTAREA_CLS} />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ImageField label="Desktop Image" value={value.desktopImage} onChange={(url) => set("desktopImage", url)} />
            <ImageField label="Mobile Image" value={value.mobileImage} onChange={(url) => set("mobileImage", url)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField label="CTA Button Label" value={value.ctaLabel} onChange={(v) => set("ctaLabel", v)} />
            <TextField label="CTA Destination URL" value={value.ctaUrl} onChange={(v) => set("ctaUrl", v)} />
          </div>
          <p className="text-[11px] text-charcoal-soft">Use the Enabled / Disabled toggle on the section row to show or hide the whole hero.</p>
        </div>
      );

    case "GIFTS_BY_OCCASION":
      return (
        <div className="space-y-4">
          <SectionHeading value={value} set={set} type={type} />
          <TextField label="Card link label (blank to hide)" value={labelValue(value, type, "cardCtaLabel")} onChange={(v) => set("cardCtaLabel", v)} />
          <ListEditor
            title="Occasion Items" addLabel="Add Occasion" itemLabel="Occasion"
            items={value.items || []} onChange={(v) => set("items", v)}
            makeItem={() => ({ title: "", image: "", destinationUrl: "/shop" })}
            renderItem={(it, up) => (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <TextField label="Title" value={it.title} onChange={(v) => up({ title: v })} />
                  <TextField label="Destination URL" value={it.destinationUrl} onChange={(v) => up({ destinationUrl: v })} />
                </div>
                <ImageField value={it.image} onChange={(url) => up({ image: url })} />
              </>
            )}
          />
        </div>
      );

    case "CURATED_STORIES":
      return (
        <div className="space-y-4">
          <SectionHeading value={value} set={set} type={type} />
          <TextField label="Story number prefix, e.g. Story 01 (blank to hide)" value={labelValue(value, type, "storyLabel")} onChange={(v) => set("storyLabel", v)} />
          <ListEditor
            title="Editorial Stories" addLabel="Add Story" itemLabel="Story"
            items={value.stories || []} onChange={(v) => set("stories", v)}
            makeItem={() => ({ heading: "", description: "", image: "", ctaLabel: "Explore", destinationUrl: "/shop", layout: "AUTO" })}
            renderItem={(st, up) => (
              <>
                <TextField label="Heading" value={st.heading} onChange={(v) => up({ heading: v })} />
                <label className="block text-xs font-semibold text-charcoal-soft">
                  Short Description
                  <textarea rows="2" value={st.description || ""} onChange={(e) => up({ description: e.target.value })} className={TEXTAREA_CLS} />
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <TextField label="CTA Label" value={st.ctaLabel} onChange={(v) => up({ ctaLabel: v })} />
                  <TextField label="Destination URL" value={st.destinationUrl} onChange={(v) => up({ destinationUrl: v })} />
                </div>
                <label className="block text-xs font-semibold text-charcoal-soft">
                  Layout orientation
                  <select value={st.layout || "AUTO"} onChange={(e) => up({ layout: e.target.value })} className={SELECT_CLS}>
                    {STORY_LAYOUTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
                <ImageField value={st.image} onChange={(url) => up({ image: url })} />
              </>
            )}
          />
        </div>
      );

    case "GIFTS_BY_FESTIVAL":
      return (
        <div className="space-y-4">
          <SectionHeading value={value} set={set} type={type} />
          <TextField label="Card link label (blank to hide)" value={labelValue(value, type, "cardCtaLabel")} onChange={(v) => set("cardCtaLabel", v)} />
          <ListEditor
            title="Festivals" addLabel="Add Festival" itemLabel="Festival"
            items={value.items || []} onChange={(v) => set("items", v)}
            makeItem={() => ({ label: "", image: "", destinationUrl: "/shop" })}
            renderItem={(it, up) => (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <TextField label="Festival Name" value={it.label} onChange={(v) => up({ label: v })} />
                  <TextField label="Destination URL" value={it.destinationUrl} onChange={(v) => up({ destinationUrl: v })} />
                </div>
                <ImageField value={it.image} onChange={(url) => up({ image: url })} />
              </>
            )}
          />
        </div>
      );

    case "GIFTING_BENEFITS":
      return (
        <div className="space-y-4">
          <SectionHeading value={value} set={set} type={type} />
          <ListEditor
            title="Benefit Cards" addLabel="Add Benefit" itemLabel="Benefit"
            items={value.cards || []} onChange={(v) => set("cards", v)}
            makeItem={() => ({ title: "", description: "", icon: "gift", image: "" })}
            renderItem={(c, up) => (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <TextField label="Title" value={c.title} onChange={(v) => up({ title: v })} />
                  <label className="block text-xs font-semibold text-charcoal-soft">
                    Icon
                    <select value={c.icon || "sparkles"} onChange={(e) => up({ icon: e.target.value })} className={SELECT_CLS}>
                      {BENEFIT_ICONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </label>
                </div>
                <label className="block text-xs font-semibold text-charcoal-soft">
                  Description (supports {"{{dispatchEstimate}}"}, {"{{deliveryEstimate}}"})
                  <textarea rows="2" value={c.description || ""} onChange={(e) => up({ description: e.target.value })} className={TEXTAREA_CLS} />
                </label>
                <ImageField label="Custom icon image (optional, replaces the icon)" value={c.image} onChange={(url) => up({ image: url })} />
              </>
            )}
          />
        </div>
      );

    case "GIFTS_BY_CRAFT":
      return (
        <div className="space-y-4">
          <SectionHeading value={value} set={set} type={type} />
          <TextField label="Card link label (blank to hide)" value={labelValue(value, type, "cardCtaLabel")} onChange={(v) => set("cardCtaLabel", v)} />
          <ListEditor
            title="Crafts" addLabel="Add Craft" itemLabel="Craft"
            items={value.crafts || []} onChange={(v) => set("crafts", v)}
            makeItem={() => ({ title: "", image: "", destinationUrl: "/shop" })}
            renderItem={(it, up) => (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <TextField label="Craft / Material" value={it.title} onChange={(v) => up({ title: v })} />
                  <TextField label="Destination URL" value={it.destinationUrl} onChange={(v) => up({ destinationUrl: v })} />
                </div>
                <ImageField value={it.image} onChange={(url) => up({ image: url })} />
              </>
            )}
          />
        </div>
      );

    case "FEATURED_GIFTS": {
      const mode = value.sourceMode || "AUTO";
      const productIds = (value.productIds || []).filter(Boolean);
      return (
        <div className="space-y-4">
          <SectionHeading value={value} set={set} type={type} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <TextField label="CTA Label" value={value.ctaLabel} onChange={(v) => set("ctaLabel", v)} />
            <TextField label="CTA URL" value={value.ctaUrl} onChange={(v) => set("ctaUrl", v)} />
            <label className="block text-xs font-semibold text-charcoal-soft">
              Products to show
              <input type="number" min="1" max="24" value={value.limit ?? 4} onChange={(e) => set("limit", Math.min(24, Math.max(1, Number(e.target.value) || 4)))} className={INPUT_CLS} />
            </label>
          </div>
          <div className="rounded-xl border border-charcoal/10 p-3 space-y-3">
            <label className="block text-xs font-semibold text-charcoal-soft">
              Product source
              <select value={mode} onChange={(e) => set("sourceMode", e.target.value)} className={SELECT_CLS}>
                <option value="AUTO">Automatic (products marked Featured)</option>
                <option value="MANUAL">Manual selection</option>
                <option value="COLLECTION">From a collection</option>
                <option value="QUERY">Dynamic query (category / search / price)</option>
              </select>
            </label>

            {mode === "MANUAL" && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-charcoal">Selected products ({productIds.length})</p>
                <select
                  aria-label="Add a product"
                  value=""
                  onChange={(e) => { if (e.target.value && !productIds.includes(e.target.value)) set("productIds", [...productIds, e.target.value]); }}
                  className="w-full rounded-xl border border-charcoal/20 px-3 py-2 text-sm"
                >
                  <option value="">+ Add a product by name or SKU…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id} disabled={!p.isActive}>{p.name} {p.sku ? `• ${p.sku}` : ""} • {p.isActive ? "Active" : "Inactive"}</option>
                  ))}
                </select>
                <div className="space-y-1">
                  {productIds.map((id, index) => {
                    const p = products.find((x) => x.id === id);
                    const swap = (to) => { const ids = [...productIds]; [ids[index], ids[to]] = [ids[to], ids[index]]; set("productIds", ids); };
                    return (
                      <div key={id} className="flex items-center gap-2 rounded border border-charcoal/10 p-2 text-xs">
                        <span className="flex-1 truncate">{p ? `${p.name}${p.sku ? ` • ${p.sku}` : ""}` : id}{p && !p.isActive && <span className="ml-1 text-terracotta">(inactive)</span>}</span>
                        <button type="button" aria-label={`Move product ${index + 1} up`} disabled={index === 0} onClick={() => swap(index - 1)} className="disabled:opacity-20">▲</button>
                        <button type="button" aria-label={`Move product ${index + 1} down`} disabled={index === productIds.length - 1} onClick={() => swap(index + 1)} className="disabled:opacity-20">▼</button>
                        <button type="button" onClick={() => set("productIds", productIds.filter((x) => x !== id))} className="text-terracotta">Remove</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {mode === "COLLECTION" && (
              <label className="block text-xs font-semibold text-charcoal-soft">
                Collection
                <select value={value.collectionSlug || ""} onChange={(e) => set("collectionSlug", e.target.value)} className={SELECT_CLS}>
                  <option value="">Select a collection…</option>
                  {collections.map((c) => <option key={c.id || c.slug} value={c.slug}>{c.name}</option>)}
                </select>
                {collections.length === 0 && (
                  <input type="text" value={value.collectionSlug || ""} onChange={(e) => set("collectionSlug", e.target.value)} placeholder="collection-slug" className={INPUT_CLS} />
                )}
              </label>
            )}

            {mode === "QUERY" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-charcoal-soft">
                  Category
                  <select value={value.queryCategory || ""} onChange={(e) => set("queryCategory", e.target.value)} className={SELECT_CLS}>
                    <option value="">Any category</option>
                    {categories.map((c) => <option key={c.id || c.slug} value={c.slug}>{c.name}</option>)}
                  </select>
                </label>
                <TextField label="Search keyword" value={value.querySearch} onChange={(v) => set("querySearch", v)} placeholder="e.g. brass" />
                <TextField label="Minimum price" type="number" value={value.queryMinPrice ?? ""} onChange={(v) => set("queryMinPrice", parsePriceInput(v))} />
                <TextField label="Maximum price" type="number" value={value.queryMaxPrice ?? ""} onChange={(v) => set("queryMaxPrice", parsePriceInput(v))} />
                <label className="block text-xs font-semibold text-charcoal-soft sm:col-span-2">
                  Sort
                  <select value={value.querySort || "newest"} onChange={(e) => set("querySort", e.target.value)} className={SELECT_CLS}>
                    {QUERY_SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
              </div>
            )}
          </div>
        </div>
      );
    }

    case "GIFTS_BY_BUDGET":
      return (
        <div className="space-y-4">
          <SectionHeading value={value} set={set} type={type} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextField label="Card link label (blank to hide)" value={labelValue(value, type, "cardCtaLabel")} onChange={(v) => set("cardCtaLabel", v)} />
            <TextField label="Tier number prefix (blank to hide)" value={labelValue(value, type, "tierLabel")} onChange={(v) => set("tierLabel", v)} />
          </div>
          <ListEditor
            title="Budget Tiers" addLabel="Add Tier" itemLabel="Tier"
            items={value.tiers || []} onChange={(v) => set("tiers", v)}
            makeItem={() => ({ label: "", description: "", destinationUrl: "", minPrice: null, maxPrice: null })}
            renderItem={(t, up) => (
              <>
                <TextField label="Label" value={t.label} onChange={(v) => up({ label: v })} placeholder="Under ₹2,000" />
                <TextField label="Short description" value={t.description} onChange={(v) => up({ description: v })} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <TextField label="Min price" type="number" value={t.minPrice ?? ""} onChange={(v) => up({ minPrice: parsePriceInput(v) })} />
                  <TextField label="Max price" type="number" value={t.maxPrice ?? ""} onChange={(v) => up({ maxPrice: parsePriceInput(v) })} />
                  <TextField label="URL (optional)" value={t.destinationUrl} onChange={(v) => up({ destinationUrl: v })} placeholder="Blank = /shop filtered by price" />
                </div>
              </>
            )}
          />
        </div>
      );

    case "GIFTING_SEO":
      return (
        <div className="space-y-4">
          <TextField label="Eyebrow (optional small label above the heading)" value={value.eyebrow ?? ""} onChange={(v) => set("eyebrow", v)} />
          <TextField label="SEO Section Heading" value={value.heading} onChange={(v) => set("heading", v)} />
          <label className="block text-xs font-semibold text-charcoal-soft">
            Editorial content (HTML: &lt;p&gt;, &lt;h3&gt;, &lt;ul&gt;, &lt;a&gt;, &lt;strong&gt;, &lt;em&gt;)
            <textarea rows="8" value={value.content || ""} onChange={(e) => set("content", e.target.value)} className={TEXTAREA_CLS} />
          </label>
        </div>
      );

    case "GIFTING_FAQ":
      return (
        <div className="space-y-4">
          <SectionHeading value={value} set={set} type={type} headingLabel="FAQ Heading" />
          <ListEditor
            title="Questions & Answers" addLabel="Add Question" itemLabel="Q"
            items={value.items || []} onChange={(v) => set("items", v)}
            makeItem={() => ({ question: "", answer: "" })}
            renderItem={(it, up) => (
              <>
                <TextField label="Question" value={it.question} onChange={(v) => up({ question: v })} />
                <label className="block text-xs font-semibold text-charcoal-soft">
                  Answer (Supports {"{{dispatchEstimate}}"}, {"{{deliveryEstimate}}"}, {"{{returnWindowDays}}"})
                  <textarea rows="3" value={it.answer || ""} onChange={(e) => up({ answer: e.target.value })} className={TEXTAREA_CLS} />
                </label>
              </>
            )}
          />
        </div>
      );

    default:
      return null;
  }
}
