import React, { useState, useEffect } from "react";
import {
  adminListBlogPosts,
  adminCreateBlogPost,
  adminUpdateBlogPost,
  adminDeleteBlogPost,
  adminPublishBlogPost,
  resolveProductImageUrl
} from "../../lib/api";
import RichTextEditor from "../../components/cms/RichTextEditor";
import MediaPicker from "../../components/cms/MediaPicker";

export default function AdminBlog() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [error, setError] = useState("");

  // Form Drawer State
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    excerpt: "",
    featuredImage: "",
    content: "",
    author: "Aadya Editorial",
    category: "Decor & Living",
    tags: "",
    isFeatured: false,
    status: "DRAFT",
    publishDate: new Date().toISOString().split("T")[0],
    seoTitle: "",
    seoDescription: ""
  });
  const [saving, setSaving] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  useEffect(() => {
    loadBlogPosts();
  }, [search, filterCategory, filterStatus]);

  const loadBlogPosts = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await adminListBlogPosts({ search, category: filterCategory, status: filterStatus });
      setPosts(res.items || res.data || []);
    } catch (err) {
      setError(err.message || "Failed to load blog posts");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNew = () => {
    setEditingId(null);
    setFormData({
      title: "",
      slug: "",
      excerpt: "",
      featuredImage: "",
      content: "",
      author: "Aadya Editorial",
      category: "Decor & Living",
      tags: "handcrafted, decor, lifestyle",
      isFeatured: false,
      status: "DRAFT",
      publishDate: new Date().toISOString().split("T")[0],
      seoTitle: "",
      seoDescription: ""
    });
    setIsEditing(true);
  };

  const handleOpenEdit = (post) => {
    setEditingId(post.id);
    setFormData({
      title: post.title || "",
      slug: post.slug || "",
      excerpt: post.excerpt || "",
      featuredImage: post.featuredImage || "",
      content: post.content || "",
      author: post.author || "Aadya Editorial",
      category: post.category || "Decor & Living",
      tags: Array.isArray(post.tags) ? post.tags.join(", ") : post.tags || "",
      isFeatured: post.isFeatured || false,
      status: post.status || "DRAFT",
      publishDate: post.publishDate ? post.publishDate.split("T")[0] : new Date().toISOString().split("T")[0],
      seoTitle: post.seoTitle || "",
      seoDescription: post.seoDescription || ""
    });
    setIsEditing(true);
  };

  const handleTitleChange = (e) => {
    const title = e.target.value;
    const generatedSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setFormData((prev) => ({
      ...prev,
      title,
      slug: editingId ? prev.slug : generatedSlug
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.slug || !formData.content) {
      setError("Title, slug, and body content are required.");
      return;
    }
    try {
      setSaving(true);
      setError("");

      const payload = {
        ...formData,
        tags: typeof formData.tags === "string"
          ? formData.tags.split(",").map((t) => t.trim()).filter(Boolean)
          : formData.tags
      };

      if (editingId) {
        await adminUpdateBlogPost(editingId, payload);
      } else {
        await adminCreateBlogPost(payload);
      }
      setIsEditing(false);
      loadBlogPosts();
    } catch (err) {
      setError(err.message || "Failed to save blog post");
    } finally {
      setSaving(false);
    }
  };

  const handlePublishToggle = async (post) => {
    try {
      const nextStatus = post.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
      await adminPublishBlogPost(post.id, nextStatus);
      loadBlogPosts();
    } catch (err) {
      setError(err.message || "Failed to update publish state");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this blog post?")) return;
    try {
      await adminDeleteBlogPost(id);
      loadBlogPosts();
    } catch (err) {
      setError(err.message || "Failed to delete blog post");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-charcoal/10 pb-4">
        <div>
          <h1 className="font-serif-display text-2xl sm:text-3xl text-charcoal">Blog CMS</h1>
          <p className="text-xs text-charcoal-soft mt-1">
            Publish lifestyle journal articles, home styling guides, decor inspiration, and craft stories.
          </p>
        </div>
        <button
          onClick={handleOpenNew}
          className="rounded-xl bg-terracotta px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-terracotta/90 transition"
        >
          + Create Blog Post
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 text-red-700 text-xs font-medium">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-2xl border border-charcoal/10">
        <input
          type="text"
          placeholder="Search blog posts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 text-xs rounded-xl border border-charcoal/15 bg-white text-charcoal focus:border-terracotta focus:outline-none"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl border border-charcoal/15 bg-white text-charcoal focus:outline-none"
        >
          <option value="">All Categories</option>
          <option value="Decor & Living">Decor & Living</option>
          <option value="Craft Stories">Craft Stories</option>
          <option value="Home Styling">Home Styling</option>
          <option value="Materials">Materials</option>
          <option value="Gifting">Gifting</option>
          <option value="Seasonal Edits">Seasonal Edits</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl border border-charcoal/15 bg-white text-charcoal focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="PUBLISHED">PUBLISHED</option>
          <option value="DRAFT">DRAFT</option>
        </select>
      </div>

      {/* Blog List Table */}
      <div className="bg-white rounded-2xl border border-charcoal/10 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-xs text-charcoal-soft animate-pulse">
            Loading blog posts...
          </div>
        ) : posts.length === 0 ? (
          <div className="p-12 text-center text-xs text-charcoal-soft">
            No blog posts found. Click "+ Create Blog Post" to add your first article.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-charcoal">
              <thead className="bg-ivory border-b border-charcoal/10 font-semibold uppercase tracking-wider text-[11px] text-charcoal-soft">
                <tr>
                  <th className="px-6 py-3">Post Title</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Featured</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Publish Date</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal/10">
                {posts.map((post) => (
                  <tr key={post.id} className="hover:bg-ivory/50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {post.featuredImage && (
                          <img
                            src={resolveProductImageUrl(post.featuredImage)}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover border border-charcoal/10"
                          />
                        )}
                        <div>
                          <p className="font-semibold text-charcoal">{post.title}</p>
                          <p className="text-[11px] text-terracotta font-mono mt-0.5">/blog/{post.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold bg-charcoal/5 text-charcoal">
                        {post.category || "General"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {post.isFeatured ? (
                        <span className="text-amber-600 font-bold text-xs">★ Featured</span>
                      ) : (
                        <span className="text-charcoal-soft/50 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                          post.status === "PUBLISHED" ? "bg-sage-light text-green-deep" : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {post.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-charcoal-soft text-[11px]">
                      {new Date(post.publishDate || post.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric"
                      })}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => window.open(`/blog/${post.slug}`, "_blank")}
                        className="px-2.5 py-1 rounded-lg border border-charcoal/15 text-[11px] font-medium hover:bg-charcoal/5"
                        title="Preview Public Article"
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => handlePublishToggle(post)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                          post.status === "PUBLISHED" ? "border border-yellow-600 text-yellow-700 hover:bg-yellow-50" : "bg-sage text-white hover:bg-sage/90"
                        }`}
                      >
                        {post.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        onClick={() => handleOpenEdit(post)}
                        className="px-2.5 py-1 rounded-lg bg-charcoal/10 text-[11px] font-medium text-charcoal hover:bg-charcoal/20"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="px-2.5 py-1 rounded-lg border border-red-200 text-red-600 text-[11px] font-medium hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Editor Modal / Drawer */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/50 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="w-full max-w-4xl bg-ivory rounded-2xl shadow-2xl border border-charcoal/10 p-6 space-y-6 max-h-[90vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between border-b border-charcoal/10 pb-3">
              <h2 className="font-serif-display text-xl text-charcoal">
                {editingId ? "Edit Blog Post" : "Create New Blog Post"}
              </h2>
              <button
                onClick={() => setIsEditing(false)}
                className="text-xs font-semibold text-charcoal-soft hover:text-charcoal"
              >
                Close ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">
                    Article Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={handleTitleChange}
                    placeholder="e.g. Styling Terracotta Vessels for Autumn"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-charcoal/15 bg-white text-charcoal focus:border-terracotta focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">
                    URL Slug *
                  </label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-") })}
                    placeholder="e.g. styling-terracotta-vessels-autumn"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-charcoal/15 bg-white text-charcoal font-mono focus:border-terracotta focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g. Decor & Living"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-charcoal/15 bg-white text-charcoal focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">
                    Author
                  </label>
                  <input
                    type="text"
                    value={formData.author}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                    placeholder="e.g. Aadya Editorial"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-charcoal/15 bg-white text-charcoal focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">
                    Publish Date
                  </label>
                  <input
                    type="date"
                    value={formData.publishDate}
                    onChange={(e) => setFormData({ ...formData, publishDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-charcoal/15 bg-white text-charcoal focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">
                    Tags (Comma Separated)
                  </label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="decor, craft, seasonal, artisan"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-charcoal/15 bg-white text-charcoal focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-6 pt-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-charcoal">
                    <input
                      type="checkbox"
                      checked={formData.isFeatured}
                      onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                      className="rounded accent-terracotta"
                    />
                    Highlight as Featured Story
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-charcoal-soft">Status:</span>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="px-2 py-1 rounded-lg border border-charcoal/15 bg-white text-xs"
                    >
                      <option value="DRAFT">DRAFT</option>
                      <option value="PUBLISHED">PUBLISHED</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Excerpt */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">
                  Article Excerpt / Subtitle
                </label>
                <textarea
                  rows={2}
                  value={formData.excerpt}
                  onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                  placeholder="Brief 1-2 sentence teaser summary for editorial cards..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-charcoal/15 bg-white text-charcoal focus:outline-none"
                />
              </div>

              {/* Featured Image */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">
                  Featured Header Image
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={formData.featuredImage}
                    onChange={(e) => setFormData({ ...formData, featuredImage: e.target.value })}
                    placeholder="https://... or choose from Media Library"
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-charcoal/15 bg-white text-charcoal focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMediaPicker(true)}
                    className="px-3 py-2 text-xs font-semibold rounded-xl border border-charcoal/15 bg-white hover:bg-charcoal/5"
                  >
                    Select Media
                  </button>
                </div>
                {formData.featuredImage && (
                  <div className="mt-2 w-36 h-24 rounded-xl overflow-hidden border border-charcoal/10 bg-white">
                    <img
                      src={resolveProductImageUrl(formData.featuredImage)}
                      alt="Blog Featured Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              {/* Article Content */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">
                  Full Rich Article Content *
                </label>
                <RichTextEditor
                  value={formData.content}
                  onChange={(html) => setFormData({ ...formData, content: html })}
                  placeholder="Compose full editorial journal post..."
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 border-t border-charcoal/10 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-charcoal/15 text-charcoal hover:bg-charcoal/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 text-xs font-semibold rounded-xl bg-terracotta text-white hover:bg-terracotta/90 transition shadow-sm disabled:opacity-50"
                >
                  {saving ? "Saving Post..." : "Save Blog Post"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Media Picker Modal */}
      <MediaPicker
        isOpen={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onSelect={(asset) => {
          setFormData((prev) => ({ ...prev, featuredImage: asset.url }));
        }}
        title="Select Featured Blog Image"
      />
    </div>
  );
}
