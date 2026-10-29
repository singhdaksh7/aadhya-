import React from "react";
import ImagePickerInput from "./ImagePickerInput";

const SELECT_CLS = "mt-1 w-full rounded-xl border border-charcoal/20 px-3 py-2 text-sm";
const INPUT_CLS = "mt-1 w-full rounded-xl border border-charcoal/20 px-3 py-2 text-sm";
const TEXTAREA_CLS = "mt-1 w-full rounded-xl border border-charcoal/20 p-3 text-sm";

const Toggle = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-2 text-xs font-semibold text-charcoal">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
  </label>
);

export default function GiftingSectionFields({ type, value = {}, onChange }) {
  const set = (key, val) => onChange({ ...value, [key]: val });

  switch (type) {
    case "GIFTING_HERO":
      return (
        <div className="space-y-4">
          <label className="block text-xs font-semibold text-charcoal-soft">
            Eyebrow
            <input type="text" value={value.eyebrow || ""} onChange={(e) => set("eyebrow", e.target.value)} className={INPUT_CLS} />
          </label>
          <label className="block text-xs font-semibold text-charcoal-soft">
            Hero Title
            <input type="text" value={value.title || ""} onChange={(e) => set("title", e.target.value)} className={INPUT_CLS} />
          </label>
          <label className="block text-xs font-semibold text-charcoal-soft">
            Description
            <textarea rows="3" value={value.description || ""} onChange={(e) => set("description", e.target.value)} className={TEXTAREA_CLS} />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="block text-xs font-semibold text-charcoal-soft mb-1">Desktop Image</span>
              <ImagePickerInput value={value.desktopImage || ""} onChange={(url) => set("desktopImage", url)} />
            </div>
            <div>
              <span className="block text-xs font-semibold text-charcoal-soft mb-1">Mobile Image</span>
              <ImagePickerInput value={value.mobileImage || ""} onChange={(url) => set("mobileImage", url)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block text-xs font-semibold text-charcoal-soft">
              CTA Button Label
              <input type="text" value={value.ctaLabel || ""} onChange={(e) => set("ctaLabel", e.target.value)} className={INPUT_CLS} />
            </label>
            <label className="block text-xs font-semibold text-charcoal-soft">
              CTA Destination URL
              <input type="text" value={value.ctaUrl || ""} onChange={(e) => set("ctaUrl", e.target.value)} className={INPUT_CLS} />
            </label>
          </div>
        </div>
      );

    case "GIFTS_BY_OCCASION": {
      const items = value.items || [];
      const updateItem = (index, key, val) => {
        const next = [...items];
        next[index] = { ...next[index], [key]: val };
        set("items", next);
      };
      const addItem = () => {
        set("items", [...items, { id: crypto.randomUUID(), title: "", image: "", destinationUrl: "/shop", sortOrder: items.length + 1, enabled: true }]);
      };
      const removeItem = (index) => {
        set("items", items.filter((_, i) => i !== index));
      };

      return (
        <div className="space-y-4">
          <label className="block text-xs font-semibold text-charcoal-soft">
            Section Heading
            <input type="text" value={value.heading || ""} onChange={(e) => set("heading", e.target.value)} className={INPUT_CLS} />
          </label>
          <label className="block text-xs font-semibold text-charcoal-soft">
            Subtitle
            <input type="text" value={value.subtitle || ""} onChange={(e) => set("subtitle", e.target.value)} className={INPUT_CLS} />
          </label>

          <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-charcoal">Occasion Items ({items.length})</span>
              <button type="button" onClick={addItem} className="text-xs font-semibold store-primary hover:underline">
                + Add Occasion
              </button>
            </div>
            <div className="space-y-3">
              {items.map((it, idx) => (
                <div key={it.id || idx} className="p-3 border border-charcoal/15 rounded-xl space-y-3 bg-charcoal/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-charcoal">Occasion #{idx + 1}</span>
                    <div className="flex items-center gap-3">
                      <Toggle label="Enabled" checked={it.enabled !== false} onChange={(v) => updateItem(idx, "enabled", v)} />
                      <button type="button" onClick={() => removeItem(idx)} className="text-xs text-red-600 hover:underline">
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block text-xs font-semibold text-charcoal-soft">
                      Title
                      <input type="text" value={it.title || ""} onChange={(e) => updateItem(idx, "title", e.target.value)} className={INPUT_CLS} />
                    </label>
                    <label className="block text-xs font-semibold text-charcoal-soft">
                      Destination URL
                      <input type="text" value={it.destinationUrl || ""} onChange={(e) => updateItem(idx, "destinationUrl", e.target.value)} className={INPUT_CLS} />
                    </label>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-charcoal-soft mb-1">Image</span>
                    <ImagePickerInput value={it.image || ""} onChange={(url) => updateItem(idx, "image", url)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    case "CURATED_STORIES": {
      const stories = value.stories || [];
      const updateStory = (index, key, val) => {
        const next = [...stories];
        next[index] = { ...next[index], [key]: val };
        set("stories", next);
      };
      const addStory = () => {
        set("stories", [...stories, { id: crypto.randomUUID(), heading: "", description: "", image: "", ctaLabel: "Explore", destinationUrl: "/shop", sortOrder: stories.length + 1, enabled: true }]);
      };
      const removeStory = (index) => {
        set("stories", stories.filter((_, i) => i !== index));
      };

      return (
        <div className="space-y-4">
          <label className="block text-xs font-semibold text-charcoal-soft">
            Section Heading
            <input type="text" value={value.heading || ""} onChange={(e) => set("heading", e.target.value)} className={INPUT_CLS} />
          </label>
          <label className="block text-xs font-semibold text-charcoal-soft">
            Subtitle
            <input type="text" value={value.subtitle || ""} onChange={(e) => set("subtitle", e.target.value)} className={INPUT_CLS} />
          </label>

          <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-charcoal">Editorial Stories ({stories.length})</span>
              <button type="button" onClick={addStory} className="text-xs font-semibold store-primary hover:underline">
                + Add Story
              </button>
            </div>
            <div className="space-y-3">
              {stories.map((st, idx) => (
                <div key={st.id || idx} className="p-3 border border-charcoal/15 rounded-xl space-y-3 bg-charcoal/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-charcoal">Story #{idx + 1}</span>
                    <div className="flex items-center gap-3">
                      <Toggle label="Enabled" checked={st.enabled !== false} onChange={(v) => updateStory(idx, "enabled", v)} />
                      <button type="button" onClick={() => removeStory(idx)} className="text-xs text-red-600 hover:underline">
                        Remove
                      </button>
                    </div>
                  </div>
                  <label className="block text-xs font-semibold text-charcoal-soft">
                    Heading
                    <input type="text" value={st.heading || ""} onChange={(e) => updateStory(idx, "heading", e.target.value)} className={INPUT_CLS} />
                  </label>
                  <label className="block text-xs font-semibold text-charcoal-soft">
                    Short Description
                    <textarea rows="2" value={st.description || ""} onChange={(e) => updateStory(idx, "description", e.target.value)} className={TEXTAREA_CLS} />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block text-xs font-semibold text-charcoal-soft">
                      CTA Label
                      <input type="text" value={st.ctaLabel || ""} onChange={(e) => updateStory(idx, "ctaLabel", e.target.value)} className={INPUT_CLS} />
                    </label>
                    <label className="block text-xs font-semibold text-charcoal-soft">
                      Destination URL
                      <input type="text" value={st.destinationUrl || ""} onChange={(e) => updateStory(idx, "destinationUrl", e.target.value)} className={INPUT_CLS} />
                    </label>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-charcoal-soft mb-1">Image</span>
                    <ImagePickerInput value={st.image || ""} onChange={(url) => updateStory(idx, "image", url)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    case "GIFTING_SEO":
      return (
        <div className="space-y-4">
          <label className="block text-xs font-semibold text-charcoal-soft">
            SEO Section Heading
            <input type="text" value={value.heading || ""} onChange={(e) => set("heading", e.target.value)} className={INPUT_CLS} />
          </label>
          <label className="block text-xs font-semibold text-charcoal-soft">
            HTML Content
            <textarea rows="6" value={value.content || ""} onChange={(e) => set("content", e.target.value)} className={TEXTAREA_CLS} />
          </label>
        </div>
      );

    case "GIFTING_FAQ": {
      const items = value.items || [];
      const updateFaq = (index, key, val) => {
        const next = [...items];
        next[index] = { ...next[index], [key]: val };
        set("items", next);
      };
      const addFaq = () => {
        set("items", [...items, { id: crypto.randomUUID(), question: "", answer: "", sortOrder: items.length + 1, enabled: true }]);
      };
      const removeFaq = (index) => {
        set("items", items.filter((_, i) => i !== index));
      };

      return (
        <div className="space-y-4">
          <label className="block text-xs font-semibold text-charcoal-soft">
            FAQ Heading
            <input type="text" value={value.heading || ""} onChange={(e) => set("heading", e.target.value)} className={INPUT_CLS} />
          </label>
          <label className="block text-xs font-semibold text-charcoal-soft">
            Subtitle
            <input type="text" value={value.subtitle || ""} onChange={(e) => set("subtitle", e.target.value)} className={INPUT_CLS} />
          </label>

          <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-charcoal">Questions & Answers ({items.length})</span>
              <button type="button" onClick={addFaq} className="text-xs font-semibold store-primary hover:underline">
                + Add Question
              </button>
            </div>
            <div className="space-y-3">
              {items.map((it, idx) => (
                <div key={it.id || idx} className="p-3 border border-charcoal/15 rounded-xl space-y-3 bg-charcoal/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-charcoal">Q#{idx + 1}</span>
                    <div className="flex items-center gap-3">
                      <Toggle label="Enabled" checked={it.enabled !== false} onChange={(v) => updateFaq(idx, "enabled", v)} />
                      <button type="button" onClick={() => removeFaq(idx)} className="text-xs text-red-600 hover:underline">
                        Remove
                      </button>
                    </div>
                  </div>
                  <label className="block text-xs font-semibold text-charcoal-soft">
                    Question
                    <input type="text" value={it.question || ""} onChange={(e) => updateFaq(idx, "question", e.target.value)} className={INPUT_CLS} />
                  </label>
                  <label className="block text-xs font-semibold text-charcoal-soft">
                    Answer (Supports {"{{dispatchEstimate}}"}, {"{{deliveryEstimate}}"}, {"{{returnWindowDays}}"})
                    <textarea rows="3" value={it.answer || ""} onChange={(e) => updateFaq(idx, "answer", e.target.value)} className={TEXTAREA_CLS} />
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}

