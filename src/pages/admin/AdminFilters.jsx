import { useEffect, useMemo, useState } from "react";
import { adminFetchSiteSettings, adminUpdateSiteSettings, fetchCategories } from "../../lib/api";
import { Button } from "../../components/ui";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";
import { refreshSiteSettings } from "../../hooks/useSiteSettings";
import { DEFAULT_GROUPS, GROUP_TYPES } from "../../lib/catalogFilterEngine";

const TYPE_LABELS = {
  CATEGORY: "Category / Subcategory", COLLECTION: "Collection", PRICE: "Price", AVAILABILITY: "Availability",
  ATTRIBUTE: "Product attribute (Color, Material, Size…)", BRAND: "Brand / Maker", BOOK_AUTHOR: "Book author",
  BOOK_LANGUAGE: "Book language", BOOK_FORMAT: "Book format", BOOK_PUBLISHER: "Book publisher",
};

const g = (type, extra = {}) => ({ id: `${type.toLowerCase()}-${extra.attributeKey ? extra.attributeKey.toLowerCase() : "x"}-${Math.random().toString(36).slice(2, 7)}`, type, enabled: true, showDesktop: true, showMobile: true, ...extra });
const PRESETS = {
  Books: () => [g("CATEGORY", { label: "Theme", defaultOpen: true }), g("BOOK_AUTHOR"), g("BOOK_FORMAT"), g("BOOK_LANGUAGE"), g("PRICE"), g("AVAILABILITY")],
  "Home Decor": () => [g("CATEGORY", { defaultOpen: true }), g("ATTRIBUTE", { attributeKey: "Material" }), g("ATTRIBUTE", { attributeKey: "Style" }), g("ATTRIBUTE", { attributeKey: "Color" }), g("PRICE"), g("AVAILABILITY")],
  Lighting: () => [g("CATEGORY", { label: "Type", defaultOpen: true }), g("ATTRIBUTE", { attributeKey: "Material" }), g("ATTRIBUTE", { attributeKey: "Finish" }), g("PRICE"), g("AVAILABILITY")],
  "Home Textiles": () => [g("CATEGORY", { defaultOpen: true }), g("ATTRIBUTE", { attributeKey: "Size" }), g("ATTRIBUTE", { attributeKey: "Material" }), g("ATTRIBUTE", { attributeKey: "Color" }), g("PRICE")],
};

const input = "rounded border border-charcoal/15 bg-white px-2 py-1 text-xs";

export default function AdminFilters() {
  const [categories, setCategories] = useState([]);
  const [config, setConfig] = useState({ categories: [] });
  const [categoryId, setCategoryId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [newType, setNewType] = useState("ATTRIBUTE");

  useEffect(() => {
    let active = true;
    Promise.all([fetchCategories(), adminFetchSiteSettings()])
      .then(([cats, settings]) => {
        if (!active) return;
        const list = cats.data || [];
        setCategories(list);
        setConfig(settings.data?.catalogFilters || { categories: [] });
        setCategoryId((prev) => prev || list.find((c) => !c.parentId)?.id || "");
      })
      .catch((e) => active && setError(e.message || "Failed to load filter settings"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const ordered = useMemo(() => {
    const byParent = new Map();
    categories.forEach((c) => { const k = c.parentId || ""; if (!byParent.has(k)) byParent.set(k, []); byParent.get(k).push(c); });
    const out = [];
    const walk = (parent, depth) => (byParent.get(parent) || []).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).forEach((c) => { out.push({ ...c, depth }); walk(c.id, depth + 1); });
    walk("", 0);
    return out;
  }, [categories]);

  const entry = config.categories.find((c) => c.categoryId === categoryId) || null;
  const updateEntry = (patch) => setConfig((prev) => ({ ...prev, categories: prev.categories.some((c) => c.categoryId === categoryId) ? prev.categories.map((c) => (c.categoryId === categoryId ? { ...c, ...patch } : c)) : [...prev.categories, { categoryId, applyToSubcategories: true, groups: [], ...patch }] }));
  const setGroups = (groups) => updateEntry({ groups });
  const updateGroup = (index, patch) => setGroups(entry.groups.map((grp, i) => (i === index ? { ...grp, ...patch } : grp)));
  const move = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= entry.groups.length) return;
    const next = [...entry.groups];
    [next[index], next[target]] = [next[target], next[index]];
    setGroups(next);
  };
  const resetToDefault = () => setConfig((prev) => ({ ...prev, categories: prev.categories.filter((c) => c.categoryId !== categoryId) }));

  const save = async () => {
    setSaving(true); setError(""); setNotice("");
    try {
      const payload = { categories: config.categories.map((c) => ({ ...c, groups: c.groups.map((grp, i) => ({ ...grp, order: i, label: grp.label?.trim() || undefined, attributeKey: grp.type === "ATTRIBUTE" ? grp.attributeKey : undefined })) })) };
      const res = await adminUpdateSiteSettings({ catalogFilters: payload });
      setConfig(res.data?.catalogFilters || payload);
      await refreshSiteSettings();
      setNotice("Filter settings saved. The storefront uses them immediately.");
    } catch (e) {
      setError(e.message || "Could not save filter settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingNotice message="Loading filter settings…" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif-display text-2xl text-charcoal">Storefront Filters</h1>
        <p className="mt-1 text-sm text-charcoal-soft">Choose which filters customers see on each category page, in what order, and how they behave. Categories without a custom setup use the default set (Category, Collection, Price, Availability). Attribute filters read the product attributes you already enter on each product.</p>
      </div>
      {error && <ErrorNotice message={error} />}
      {notice && <p role="status" className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-800">{notice}</p>}

      <div className="rounded-2xl border border-charcoal/10 bg-white p-5 space-y-4">
        <label className="block text-xs font-semibold text-charcoal-soft">Category
          <select aria-label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={`${input} mt-1 block w-full max-w-md`}>
            {ordered.map((c) => <option key={c.id} value={c.id}>{`${"— ".repeat(c.depth)}${c.name}${config.categories.some((x) => x.categoryId === c.id) ? "  ✓ custom" : ""}`}</option>)}
          </select>
        </label>

        {!entry ? (
          <div className="space-y-3">
            <p className="text-sm text-charcoal-soft">This category uses the default filters. Start from a preset or customise the default set.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => updateEntry({ groups: DEFAULT_GROUPS.map((d) => g(d.type)) })} className="rounded-full border border-terracotta px-3 py-1 text-xs text-terracotta">Customise default set</button>
              {Object.keys(PRESETS).map((name) => (
                <button key={name} type="button" onClick={() => updateEntry({ groups: PRESETS[name]() })} className="rounded-full border border-charcoal/20 px-3 py-1 text-xs text-charcoal">Preset: {name}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-xs font-semibold text-charcoal">
              <input type="checkbox" checked={entry.applyToSubcategories !== false} onChange={(e) => updateEntry({ applyToSubcategories: e.target.checked })} /> Also apply to subcategories without their own setup
            </label>
            <div className="space-y-2">
              {entry.groups.map((grp, i) => (
                <div key={grp.id} data-testid="filter-group-row" className="grid gap-2 rounded-xl border border-charcoal/10 p-3 sm:grid-cols-12 sm:items-center">
                  <label className="flex items-center gap-1.5 text-xs sm:col-span-2"><input type="checkbox" checked={grp.enabled !== false} onChange={(e) => updateGroup(i, { enabled: e.target.checked })} aria-label={`Enable filter ${i + 1}`} /> On</label>
                  <div className="sm:col-span-3">
                    <p className="text-[10px] uppercase tracking-wider text-charcoal-soft">{TYPE_LABELS[grp.type]}</p>
                    {grp.type === "ATTRIBUTE" && <input aria-label={`Attribute key ${i + 1}`} value={grp.attributeKey || ""} placeholder="Attribute name, e.g. Color" onChange={(e) => updateGroup(i, { attributeKey: e.target.value })} className={`${input} mt-1 w-full`} />}
                  </div>
                  <input aria-label={`Label ${i + 1}`} value={grp.label || ""} placeholder="Label (optional)" onChange={(e) => updateGroup(i, { label: e.target.value })} className={`${input} sm:col-span-2`} />
                  <select aria-label={`Selection ${i + 1}`} value={grp.selection || (["ATTRIBUTE", "BRAND", "BOOK_AUTHOR", "BOOK_LANGUAGE", "BOOK_FORMAT", "BOOK_PUBLISHER"].includes(grp.type) ? "MULTI" : "SINGLE")} onChange={(e) => updateGroup(i, { selection: e.target.value })} className={`${input} sm:col-span-2`}>
                    <option value="MULTI">Multi-select</option>
                    <option value="SINGLE">Single-select</option>
                  </select>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] sm:col-span-3">
                    <label className="flex items-center gap-1"><input type="checkbox" checked={grp.defaultOpen === true} onChange={(e) => updateGroup(i, { defaultOpen: e.target.checked })} /> Open</label>
                    <label className="flex items-center gap-1"><input type="checkbox" checked={grp.showDesktop !== false} onChange={(e) => updateGroup(i, { showDesktop: e.target.checked })} /> Desktop</label>
                    <label className="flex items-center gap-1"><input type="checkbox" checked={grp.showMobile !== false} onChange={(e) => updateGroup(i, { showMobile: e.target.checked })} /> Mobile</label>
                    <span className="ml-auto flex items-center gap-1">
                      <button type="button" aria-label={`Move filter ${i + 1} up`} onClick={() => move(i, -1)} className="rounded border px-1.5">↑</button>
                      <button type="button" aria-label={`Move filter ${i + 1} down`} onClick={() => move(i, 1)} className="rounded border px-1.5">↓</button>
                      <button type="button" aria-label={`Delete filter ${i + 1}`} onClick={() => setGroups(entry.groups.filter((_, x) => x !== i))} className="rounded border border-terracotta px-1.5 text-terracotta">✕</button>
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select aria-label="New filter type" value={newType} onChange={(e) => setNewType(e.target.value)} className={input}>
                {GROUP_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
              <button type="button" onClick={() => setGroups([...entry.groups, g(newType, newType === "ATTRIBUTE" ? { attributeKey: "" } : {})])} className="rounded-full border border-terracotta px-3 py-1 text-xs text-terracotta">+ Add filter</button>
              <button type="button" onClick={resetToDefault} className="ml-auto text-xs text-charcoal-soft underline">Reset this category to default filters</button>
            </div>
          </div>
        )}
      </div>

      <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save filter settings"}</Button>
    </div>
  );
}
