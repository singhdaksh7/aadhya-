import React, { useState } from "react";
import MediaPicker from "../cms/MediaPicker";
import { resolveProductImageUrl } from "../../lib/api";

/**
 * Shared wrapper around the existing MediaPicker/Media Library component for
 * admin image fields. Composes MediaPicker — it does not introduce any new
 * upload architecture. Gives every admin image field a consistent UX:
 * preview, "Choose from Media Library" (browse + upload-new-file, both
 * handled inside MediaPicker), a "Paste URL" fallback text input, and
 * "Remove".
 */
export default function ImagePickerInput({
  label,
  value,
  onChange,
  placeholder = "https://... or choose from Media Library",
  required = false,
  pickerTitle = "Select Media Asset",
  inputClassName = "w-full rounded-xl border border-charcoal/15 px-4 py-2.5 text-sm focus:border-charcoal/40 focus:outline-none",
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (asset) => {
    onChange(asset.url);
    setIsOpen(false);
  };

  return (
    <div>
      {label && <label className="text-xs font-semibold text-charcoal-soft">{label}</label>}
      <div className="mt-1 flex items-center gap-3">
        {value ? (
          <img
            src={resolveProductImageUrl(value)}
            alt=""
            className="h-14 w-14 shrink-0 rounded-lg border border-charcoal/10 object-cover bg-ivory"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-charcoal/20 text-[10px] text-charcoal-soft">
            No image
          </div>
        )}
        <div className="flex-1 space-y-2">
          <input
            type="text"
            required={required}
            placeholder={placeholder}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            className={inputClassName}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="rounded-full border border-charcoal/20 bg-white px-3 py-1 text-xs font-semibold text-charcoal hover:border-terracotta hover:text-terracotta transition"
            >
              Choose from Media Library
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="rounded-full border border-terracotta/20 bg-terracotta/5 px-3 py-1 text-xs font-semibold text-terracotta hover:bg-terracotta hover:text-ivory transition"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      <MediaPicker isOpen={isOpen} onClose={() => setIsOpen(false)} onSelect={handleSelect} title={pickerTitle} />
    </div>
  );
}
