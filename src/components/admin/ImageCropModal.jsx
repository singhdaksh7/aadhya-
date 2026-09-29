import React, { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import { IconClose } from "../icons";

// Aspect ratio presets shared by every appearance/media field that opts into
// cropping. `null` means "free" (no fixed ratio).
export const CROP_ASPECT_PRESETS = {
  free: { label: "Free", value: null },
  wide: { label: "Wide (16:9)", value: 16 / 9 },
  square: { label: "Square (1:1)", value: 1 },
  banner: { label: "Banner (21:9)", value: 21 / 9 },
};

function createImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", (err) => reject(err));
    img.src = url;
  });
}

// Renders the visible crop area of `imageSrc` (per react-easy-crop's
// pixel-space croppedAreaPixels) onto a canvas and returns it as a Blob,
// preserving the original image's encoding quality. This produces an
// optimized derivative for upload — the source media asset itself is never
// mutated, only read.
async function getCroppedImageBlob(imageSrc, croppedAreaPixels, mimeType = "image/png") {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(croppedAreaPixels.width);
  canvas.height = Math.round(croppedAreaPixels.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    croppedAreaPixels.width,
    croppedAreaPixels.height
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not generate cropped image"))),
      mimeType,
      0.92
    );
  });
}

/**
 * Reusable crop/adjust modal built on react-easy-crop (actively maintained,
 * no native deps). Used by ImagePickerInput for every appearance/media field
 * that opts into cropping — logo, favicon, footer logo, banners, category &
 * collection images, blog/CMS featured images, product OG image. Product
 * gallery crop is opt-in by only rendering this modal when the caller wires
 * a "Crop" action, never automatically on upload.
 */
export default function ImageCropModal({
  isOpen,
  imageSrc,
  aspect = null,
  aspectOptions, // optional array of preset keys from CROP_ASPECT_PRESETS, e.g. ["free", "wide", "square"]
  outputMimeType = "image/png",
  onCancel,
  onConfirm, // (blob) => void | Promise<void>
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [currentAspect, setCurrentAspect] = useState(aspect);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const onCropComplete = useCallback((_croppedArea, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    try {
      setSaving(true);
      setError("");
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels, outputMimeType);
      await onConfirm(blob);
    } catch (err) {
      setError(err.message || "Could not crop this image. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onCancel(); }}
    >
      <div role="dialog" aria-modal="true" aria-label="Crop image" className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-charcoal/10 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-charcoal/10 px-5 py-3">
          <h3 className="font-serif-display text-lg text-charcoal">Crop / Adjust Image</h3>
          <button type="button" onClick={onCancel} disabled={saving} className="rounded-full p-1.5 text-charcoal-soft hover:bg-charcoal/5" aria-label="Close">
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        <div className="relative h-80 w-full bg-charcoal/90">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={currentAspect || undefined}
            objectFit="contain"
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="space-y-3 px-5 py-4">
          {aspectOptions?.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {aspectOptions.map((key) => {
                const preset = CROP_ASPECT_PRESETS[key];
                if (!preset) return null;
                const active = currentAspect === preset.value;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCurrentAspect(preset.value)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      active ? "border-terracotta bg-terracotta text-white" : "border-charcoal/20 text-charcoal hover:border-terracotta"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-3">
            <label htmlFor="crop-zoom" className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Zoom</label>
            <input
              id="crop-zoom"
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1"
            />
            <button type="button" onClick={handleReset} className="rounded-full border border-charcoal/20 px-3 py-1 text-xs font-semibold text-charcoal hover:border-terracotta">
              Reset
            </button>
          </div>

          {error && <p className="text-xs font-semibold text-terracotta">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-charcoal/10 px-5 py-4">
          <button type="button" onClick={onCancel} disabled={saving} className="rounded-xl border border-charcoal/15 px-4 py-2 text-xs font-semibold text-charcoal hover:bg-charcoal/5">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving || !croppedAreaPixels}
            className="rounded-xl bg-terracotta px-5 py-2 text-xs font-semibold text-white hover:bg-terracotta/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Confirm Crop"}
          </button>
        </div>
      </div>
    </div>
  );
}
