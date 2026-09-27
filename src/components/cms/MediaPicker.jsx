import React, { useState, useEffect, useRef } from "react";
import { adminListMedia, adminUploadMedia, resolveProductImageUrl } from "../../lib/api";
import { IconClose } from "../icons";

export default function MediaPicker({ isOpen, onClose, onSelect, title = "Select Media Asset" }) {
  const [tab, setTab] = useState("browse"); // "browse" | "upload"
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [error, setError] = useState("");

  // Upload Form State
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadAlt, setUploadAlt] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploading, setUploading] = useState(false);

  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      loadMedia();
    }
  }, [isOpen, search]);

  // Focus management: move focus into the modal on open, trap Tab within it,
  // close on Escape, and restore focus to the trigger element on close.
  useEffect(() => {
    if (!isOpen) return undefined;

    previouslyFocusedRef.current = document.activeElement;
    closeButtonRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

  const loadMedia = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await adminListMedia({ search, limit: 30 });
      setItems(res.items || res.data || []);
    } catch (err) {
      setError(err.message || "Failed to load media assets");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      setError("Please select a file to upload.");
      return;
    }
    try {
      setUploading(true);
      setError("");
      const res = await adminUploadMedia(uploadFile, { altText: uploadAlt, title: uploadTitle });
      const asset = res.data || res;
      setItems((prev) => [asset, ...prev]);
      setSelectedAsset(asset);
      setTab("browse");
      setUploadFile(null);
      setUploadAlt("");
      setUploadTitle("");
    } catch (err) {
      setError(err.message || "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmSelect = () => {
    if (selectedAsset) {
      onSelect(selectedAsset);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/50 backdrop-blur-sm animate-fade-in"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-picker-title"
        className="flex flex-col w-full max-w-4xl max-h-[90vh] bg-ivory rounded-2xl shadow-2xl border border-charcoal/10 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-charcoal/10 bg-white">
          <h3 id="media-picker-title" className="font-serif-display text-xl text-charcoal">{title}</h3>
          <button
            type="button"
            ref={closeButtonRef}
            onClick={onClose}
            className="p-1.5 rounded-full text-charcoal-soft hover:bg-charcoal/5 transition"
            aria-label="Close"
          >
            <IconClose className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-charcoal/10 bg-white/50 px-6 gap-6 text-sm font-medium">
          <button
            type="button"
            onClick={() => setTab("browse")}
            className={`py-3 border-b-2 transition ${
              tab === "browse" ? "border-terracotta text-terracotta font-semibold" : "border-transparent text-charcoal-soft hover:text-charcoal"
            }`}
          >
            Browse Library
          </button>
          <button
            type="button"
            onClick={() => setTab("upload")}
            className={`py-3 border-b-2 transition ${
              tab === "upload" ? "border-terracotta text-terracotta font-semibold" : "border-transparent text-charcoal-soft hover:text-charcoal"
            }`}
          >
            Upload New File
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 text-red-700 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === "browse" ? (
            <div className="space-y-4">
              {/* Search Bar */}
              <label htmlFor="media-picker-search" className="sr-only">Search media library</label>
              <input
                id="media-picker-search"
                type="text"
                placeholder="Search media by filename, alt text, title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-2 text-sm rounded-xl border border-charcoal/15 bg-white text-charcoal placeholder-charcoal-soft/60 focus:border-terracotta focus:outline-none"
              />

              {loading ? (
                <div className="py-12 text-center text-sm text-charcoal-soft animate-pulse">
                  Loading media library...
                </div>
              ) : items.length === 0 ? (
                <div className="py-12 text-center text-sm text-charcoal-soft">
                  No media assets found. Upload an image to get started!
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {items.map((asset) => {
                    const imgUrl = resolveProductImageUrl(asset.url);
                    const isSelected = selectedAsset?.id === asset.id;
                    return (
                      <div
                        key={asset.id}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        onClick={() => setSelectedAsset(asset)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedAsset(asset);
                          }
                        }}
                        className={`group relative cursor-pointer rounded-xl overflow-hidden border-2 bg-white transition shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta ${
                          isSelected ? "border-terracotta ring-2 ring-terracotta/20" : "border-charcoal/10 hover:border-charcoal/30"
                        }`}
                      >
                        <div className="aspect-square w-full overflow-hidden bg-ivory flex items-center justify-center">
                          <img
                            src={imgUrl}
                            alt={asset.altText || asset.fileName}
                            className="object-cover w-full h-full group-hover:scale-105 transition duration-300"
                            loading="lazy"
                          />
                        </div>
                        <div className="p-2 text-xs truncate text-charcoal font-medium bg-white border-t border-charcoal/5">
                          {asset.title || asset.originalName || asset.fileName}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Upload Tab — a plain div, not a <form>: MediaPicker is
               routinely rendered inside other admin forms (Category,
               Banner, Product, ...) via ImagePickerInput, and a nested
               <form> is invalid HTML — browsers silently drop the inner
               form tag, which would submit the *outer* host form instead
               of running handleUpload. */
            <div className="space-y-4 max-w-lg mx-auto py-4">
              <div>
                <label htmlFor="media-picker-file" className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-2">
                  Select Image File (JPEG, PNG, WebP)
                </label>
                <input
                  id="media-picker-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  className="w-full text-xs text-charcoal border border-charcoal/15 rounded-xl p-2 bg-white"
                  required
                />
              </div>

              <div>
                <label htmlFor="media-picker-alt" className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">
                  Alt Text (Accessibility)
                </label>
                <input
                  id="media-picker-alt"
                  type="text"
                  placeholder="Describe image content"
                  value={uploadAlt}
                  onChange={(e) => setUploadAlt(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-charcoal/15 bg-white text-charcoal focus:border-terracotta focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="media-picker-title" className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">
                  Title (Optional)
                </label>
                <input
                  id="media-picker-title"
                  type="text"
                  placeholder="Asset title"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-charcoal/15 bg-white text-charcoal focus:border-terracotta focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading || !uploadFile}
                className="w-full py-2.5 px-4 rounded-xl bg-terracotta text-white font-semibold text-sm hover:bg-terracotta/90 transition disabled:opacity-50 shadow-sm"
              >
                {uploading ? "Uploading Image..." : "Upload to Library"}
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-charcoal/10 bg-white">
          <div className="text-xs text-charcoal-soft">
            {selectedAsset ? `Selected: ${selectedAsset.fileName}` : "No image selected"}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-charcoal/15 text-charcoal hover:bg-charcoal/5 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmSelect}
              disabled={!selectedAsset}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-terracotta text-white hover:bg-terracotta/90 transition disabled:opacity-40 shadow-sm"
            >
              Select Image
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
