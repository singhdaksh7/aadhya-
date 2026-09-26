import React, { useState, useEffect } from "react";
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

  useEffect(() => {
    if (isOpen) {
      loadMedia();
    }
  }, [isOpen, search]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/50 backdrop-blur-sm animate-fade-in">
      <div className="flex flex-col w-full max-w-4xl max-h-[90vh] bg-ivory rounded-2xl shadow-2xl border border-charcoal/10 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-charcoal/10 bg-white">
          <h3 className="font-serif-display text-xl text-charcoal">{title}</h3>
          <button
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
            onClick={() => setTab("browse")}
            className={`py-3 border-b-2 transition ${
              tab === "browse" ? "border-terracotta text-terracotta font-semibold" : "border-transparent text-charcoal-soft hover:text-charcoal"
            }`}
          >
            Browse Library
          </button>
          <button
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
              <input
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
                        onClick={() => setSelectedAsset(asset)}
                        className={`group relative cursor-pointer rounded-xl overflow-hidden border-2 bg-white transition shadow-sm ${
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
            /* Upload Tab */
            <form onSubmit={handleUpload} className="space-y-4 max-w-lg mx-auto py-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-2">
                  Select Image File (JPEG, PNG, WebP)
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  className="w-full text-xs text-charcoal border border-charcoal/15 rounded-xl p-2 bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">
                  Alt Text (Accessibility)
                </label>
                <input
                  type="text"
                  placeholder="Describe image content"
                  value={uploadAlt}
                  onChange={(e) => setUploadAlt(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-charcoal/15 bg-white text-charcoal focus:border-terracotta focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">
                  Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Asset title"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-charcoal/15 bg-white text-charcoal focus:border-terracotta focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={uploading || !uploadFile}
                className="w-full py-2.5 px-4 rounded-xl bg-terracotta text-white font-semibold text-sm hover:bg-terracotta/90 transition disabled:opacity-50 shadow-sm"
              >
                {uploading ? "Uploading Image..." : "Upload to Library"}
              </button>
            </form>
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
