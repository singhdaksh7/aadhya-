import React, { useState, useEffect } from "react";
import {
  adminListMedia,
  adminUploadMedia,
  adminUpdateMedia,
  adminDeleteMedia,
  resolveProductImageUrl
} from "../../lib/api";

export default function AdminMedia() {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  // Upload Form State
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadAlt, setUploadAlt] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploading, setUploading] = useState(false);

  // Detail Modal State
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [editAlt, setEditAlt] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadMedia();
  }, [search]);

  const loadMedia = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await adminListMedia({ search, limit: 60 });
      setMedia(res.items || res.data || []);
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
      await adminUploadMedia(uploadFile, { altText: uploadAlt, title: uploadTitle });
      setUploadFile(null);
      setUploadAlt("");
      setUploadTitle("");
      loadMedia();
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleOpenDetail = (asset) => {
    setSelectedAsset(asset);
    setEditAlt(asset.altText || "");
    setEditTitle(asset.title || "");
  };

  const handleUpdateMetadata = async (e) => {
    e.preventDefault();
    if (!selectedAsset) return;
    try {
      setUpdating(true);
      setError("");
      await adminUpdateMedia(selectedAsset.id, { altText: editAlt, title: editTitle });
      setSelectedAsset(null);
      loadMedia();
    } catch (err) {
      setError(err.message || "Failed to update media metadata");
    } finally {
      setUpdating(false);
    }
  };

  const handleCopyUrl = (asset) => {
    const fullUrl = resolveProductImageUrl(asset.url);
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(asset.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id, force = false) => {
    try {
      setError("");
      await adminDeleteMedia(id, force);
      setSelectedAsset(null);
      loadMedia();
    } catch (err) {
      if (err.status === 409 && !force) {
        if (window.confirm("This media asset is currently referenced in published content. Are you sure you want to force delete it?")) {
          handleDelete(id, true);
        }
      } else {
        setError(err.message || "Failed to delete media asset");
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-charcoal/10 pb-4">
        <div>
          <h1 className="font-serif-display text-2xl sm:text-3xl text-charcoal">Media Library</h1>
          <p className="text-xs text-charcoal-soft mt-1">
            Centralized media asset store for blog images, CMS banners, and storefront graphics.
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 text-red-700 text-xs font-medium">
          {error}
        </div>
      )}

      {/* Upload Box */}
      <div className="bg-white p-5 rounded-2xl border border-charcoal/10 shadow-sm space-y-3">
        <h3 className="font-serif-display text-base text-charcoal">Upload New Image</h3>
        <form onSubmit={handleUpload} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-[11px] font-semibold uppercase text-charcoal-soft mb-1">
              File (JPEG, PNG, WebP) *
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setUploadFile(e.target.files[0])}
              className="w-full text-xs text-charcoal border border-charcoal/15 rounded-xl p-1.5 bg-ivory/50"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase text-charcoal-soft mb-1">
              Alt Text
            </label>
            <input
              type="text"
              placeholder="Descriptive alt text"
              value={uploadAlt}
              onChange={(e) => setUploadAlt(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-charcoal/15 bg-white text-charcoal focus:border-terracotta focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase text-charcoal-soft mb-1">
              Title (Optional)
            </label>
            <input
              type="text"
              placeholder="Internal asset title"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-charcoal/15 bg-white text-charcoal focus:border-terracotta focus:outline-none"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={uploading || !uploadFile}
              className="w-full py-2 px-4 rounded-xl bg-terracotta text-white font-semibold text-xs hover:bg-terracotta/90 transition disabled:opacity-50 shadow-sm"
            >
              {uploading ? "Uploading..." : "Upload Image"}
            </button>
          </div>
        </form>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-charcoal/10">
        <input
          type="text"
          placeholder="Search media by filename, alt text, or title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2 text-xs rounded-xl border border-charcoal/15 bg-white text-charcoal focus:border-terracotta focus:outline-none"
        />
      </div>

      {/* Media Grid */}
      <div className="bg-white p-6 rounded-2xl border border-charcoal/10 shadow-sm">
        {loading ? (
          <div className="py-12 text-center text-xs text-charcoal-soft animate-pulse">
            Loading media library...
          </div>
        ) : media.length === 0 ? (
          <div className="py-12 text-center text-xs text-charcoal-soft">
            No media assets found in library.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {media.map((asset) => {
              const fullUrl = resolveProductImageUrl(asset.url);
              return (
                <div
                  key={asset.id}
                  onClick={() => handleOpenDetail(asset)}
                  className="group relative cursor-pointer rounded-xl overflow-hidden border border-charcoal/10 bg-ivory/50 hover:border-terracotta/50 hover:shadow-md transition"
                >
                  <div className="aspect-square w-full overflow-hidden bg-ivory flex items-center justify-center">
                    <img
                      src={fullUrl}
                      alt={asset.altText || asset.fileName}
                      className="object-cover w-full h-full group-hover:scale-105 transition duration-300"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-2 bg-white border-t border-charcoal/5">
                    <p className="text-[11px] font-medium text-charcoal truncate">
                      {asset.title || asset.originalName || asset.fileName}
                    </p>
                    <p className="text-[10px] text-charcoal-soft/70 mt-0.5">
                      {(asset.size / 1024).toFixed(1)} KB • {asset.mimeType.replace("image/", "").toUpperCase()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail / Edit Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-ivory rounded-2xl shadow-2xl border border-charcoal/10 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-charcoal/10 pb-3">
              <h2 className="font-serif-display text-lg text-charcoal">Media Asset Details</h2>
              <button
                onClick={() => setSelectedAsset(null)}
                className="text-xs font-semibold text-charcoal-soft hover:text-charcoal"
              >
                Close ✕
              </button>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-32 h-32 rounded-xl overflow-hidden border border-charcoal/10 bg-white shrink-0">
                <img
                  src={resolveProductImageUrl(selectedAsset.url)}
                  alt={selectedAsset.altText || ""}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="space-y-1 text-xs text-charcoal-soft">
                <p className="font-semibold text-charcoal text-sm">{selectedAsset.fileName}</p>
                <p>Original: {selectedAsset.originalName}</p>
                <p>Size: {(selectedAsset.size / 1024).toFixed(1)} KB</p>
                <p>Type: {selectedAsset.mimeType}</p>
                <p className="text-[10px] text-charcoal-soft/60">
                  Uploaded: {new Date(selectedAsset.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            <form onSubmit={handleUpdateMetadata} className="space-y-4 border-t border-charcoal/10 pt-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">
                  Alt Text (Accessibility)
                </label>
                <input
                  type="text"
                  value={editAlt}
                  onChange={(e) => setEditAlt(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-charcoal/15 bg-white text-charcoal focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-charcoal/15 bg-white text-charcoal focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between border-t border-charcoal/10 pt-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyUrl(selectedAsset)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-charcoal/15 bg-white text-charcoal hover:bg-charcoal/5"
                  >
                    {copiedId === selectedAsset.id ? "✓ Copied!" : "Copy Image URL"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(selectedAsset.id)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-red-200 text-red-600 hover:bg-red-50"
                  >
                    Delete Asset
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-5 py-1.5 text-xs font-semibold rounded-xl bg-terracotta text-white"
                >
                  {updating ? "Saving..." : "Save Details"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
