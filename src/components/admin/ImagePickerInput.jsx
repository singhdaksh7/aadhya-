import React, { useState } from "react";
import MediaPicker from "../cms/MediaPicker";
import ImageCropModal from "./ImageCropModal";
import { resolveProductImageUrl, adminUploadMedia } from "../../lib/api";

/**
 * Shared wrapper around the existing MediaPicker/Media Library component for
 * admin image fields. Composes MediaPicker — it does not introduce any new
 * upload architecture. Gives every admin image field a consistent UX:
 * preview, "Choose from Media Library" (browse + upload-new-file, both
 * handled inside MediaPicker), an optional "Crop / Adjust" step (built on
 * the reusable ImageCropModal), a "Paste URL" fallback text input, and
 * "Remove".
 *
 * Cropping is opt-in per field via `aspect`/`aspectOptions` — callers that
 * don't pass them (e.g. the product gallery) get the original, uncropped
 * picker behavior unchanged.
 */
export default function ImagePickerInput({
  label,
  value,
  onChange,
  placeholder = "https://... or choose from Media Library",
  required = false,
  pickerTitle = "Select Media Asset",
  inputClassName = "w-full rounded-xl border border-charcoal/15 px-4 py-2.5 text-sm focus:border-charcoal/40 focus:outline-none",
  // Crop support (opt-in). `aspect`: number | null (null = free).
  // `aspectOptions`: array of CROP_ASPECT_PRESETS keys to expose as presets.
  enableCrop = false,
  aspect = null,
  aspectOptions,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);

  const resolvedValue = resolveProductImageUrl(value);

  const handleSelect = (asset) => {
    onChange(asset.url);
    setIsOpen(false);
  };

  const handleCropConfirm = async (blob) => {
    // Upload the cropped derivative through the existing media upload
    // pipeline (never a giant base64 blob stored inline in SiteSetting
    // JSON) and store the resulting media URL, same as any other selection.
    const file = new File([blob], "cropped-image.png", { type: blob.type || "image/png" });
    const res = await adminUploadMedia(file, { title: "Cropped image" });
    const asset = res.data || res;
    onChange(asset.url);
    setCropOpen(false);
  };

  return (
    <div>
      {label && <label className="text-xs font-semibold text-charcoal-soft">{label}</label>}
      <div className="mt-1 flex items-center gap-3">
        {value ? (
          <img
            src={resolvedValue}
            alt=""
            className="h-14 w-14 shrink-0 rounded-lg border border-charcoal/10 object-cover bg-ivory"
            onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="rounded-full border border-charcoal/20 bg-white px-3 py-1 text-xs font-semibold text-charcoal hover:border-terracotta hover:text-terracotta transition"
            >
              {value ? "Change" : "Upload / Choose from Media"}
            </button>
            {enableCrop && value && (
              <button
                type="button"
                onClick={() => setCropOpen(true)}
                className="rounded-full border border-charcoal/20 bg-white px-3 py-1 text-xs font-semibold text-charcoal hover:border-terracotta hover:text-terracotta transition"
              >
                Crop / Adjust
              </button>
            )}
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

      {enableCrop && (
        <ImageCropModal
          isOpen={cropOpen}
          imageSrc={resolvedValue}
          aspect={aspect}
          aspectOptions={aspectOptions}
          onCancel={() => setCropOpen(false)}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  );
}
