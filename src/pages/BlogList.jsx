import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { fetchBlogPosts, resolveProductImageUrl } from "../lib/api";
import { canonicalUrl } from "../lib/seo";

export default function BlogList() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = [
    "All",
    "Decor & Living",
    "Craft Stories",
    "Home Styling",
    "Materials",
    "Gifting",
    "Seasonal Edits"
  ];

  useEffect(() => {
    loadBlogPosts();
  }, [selectedCategory]);

  const loadBlogPosts = async () => {
    try {
      setLoading(true);
      const query = selectedCategory !== "All" ? { category: selectedCategory } : {};
      const res = await fetchBlogPosts(query);
      setPosts(res.items || res.data || []);
    } catch (err) {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const featuredPost = posts.find((p) => p.isFeatured) || posts[0];
  const regularPosts = featuredPost ? posts.filter((p) => p.id !== featuredPost.id) : posts;

  return (
    <div className="store-bg min-h-screen py-12 px-5 sm:px-8 space-y-12 max-w-7xl mx-auto animate-fade-in">
      <title>Living & Craft Stories — Aadya Lifestyle Journal</title>
      <meta
        name="description"
        content="Artisanal inspirations, slow living philosophy, decor edits, and home styling guides curated by Aadya Society."
      />
      <link rel="canonical" href={canonicalUrl("/blog")} />
      {/* Header Section */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <span className="text-xs font-semibold uppercase tracking-widest store-primary">Aadya Lifestyle Journal</span>
        <h1 className="font-serif-display text-4xl sm:text-5xl store-text">Living & Craft Stories</h1>
        <p className="text-sm store-muted leading-relaxed">
          Explore artisanal inspirations, slow living philosophy, decor edits, and home styling guides curated by Aadya Society.
        </p>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap justify-center gap-2 border-b store-border pb-6">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-full text-xs font-medium transition ${
              selectedCategory === cat
                ? "store-bg-primary text-white font-semibold shadow-sm"
                : "bg-ivory store-muted hover:bg-charcoal/5"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center text-xs store-muted animate-pulse">
          Curating journal stories...
        </div>
      ) : posts.length === 0 ? (
        <div className="py-20 text-center text-sm store-muted">
          No journal articles found in this category.
        </div>
      ) : (
        <>
          {/* Featured Hero Card */}
          {featuredPost && (
            <div className="rounded-3xl overflow-hidden border store-border bg-ivory grid grid-cols-1 lg:grid-cols-2 gap-8 p-6 sm:p-10 shadow-sm items-center">
              {featuredPost.featuredImage && (
                <div className="aspect-[16/10] w-full rounded-2xl overflow-hidden store-surface border border-charcoal/5">
                  <img
                    src={resolveProductImageUrl(featuredPost.featuredImage)}
                    alt={featuredPost.title}
                    className="w-full h-full object-cover hover:scale-105 transition duration-500"
                  />
                </div>
              )}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider store-bg-primary-soft store-primary">
                    {featuredPost.category || "Featured Story"}
                  </span>
                  <span className="text-xs store-muted">
                    {new Date(featuredPost.publishDate || featuredPost.createdAt).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                      year: "numeric"
                    })}
                  </span>
                </div>
                <h2 className="font-serif-display text-2xl sm:text-4xl store-text leading-tight">
                  <Link to={`/blog/${featuredPost.slug}`} className="hover:store-primary transition">
                    {featuredPost.title}
                  </Link>
                </h2>
                {featuredPost.excerpt && (
                  <p className="text-sm store-muted leading-relaxed">
                    {featuredPost.excerpt}
                  </p>
                )}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs store-text font-medium">By {featuredPost.author || "Aadya Editorial"}</span>
                  <Link
                    to={`/blog/${featuredPost.slug}`}
                    className="rounded-xl store-bg-primary store-primary-hover px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition"
                  >
                    Read Full Story →
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Articles Grid */}
          {regularPosts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pt-6">
              {regularPosts.map((post) => (
                <article key={post.id} className="group flex flex-col justify-between space-y-4 rounded-2xl border store-border p-5 store-surface shadow-sm hover:shadow-md transition">
                  <div className="space-y-3">
                    {post.featuredImage && (
                      <div className="aspect-[16/10] rounded-xl overflow-hidden bg-ivory border border-charcoal/5">
                        <img
                          src={resolveProductImageUrl(post.featuredImage)}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider store-primary">
                        {post.category || "Journal"}
                      </span>
                      <span className="store-muted/40">•</span>
                      <span className="text-[11px] store-muted">
                        {new Date(post.publishDate || post.createdAt).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric"
                        })}
                      </span>
                    </div>
                    <h3 className="font-serif-display text-xl store-text group-hover:store-primary transition">
                      <Link to={`/blog/${post.slug}`}>{post.title}</Link>
                    </h3>
                    {post.excerpt && (
                      <p className="text-xs store-muted line-clamp-3 leading-relaxed">{post.excerpt}</p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-charcoal/5 flex items-center justify-between">
                    <span className="text-[11px] store-text font-medium">{post.author || "Aadya Editorial"}</span>
                    <Link to={`/blog/${post.slug}`} className="text-xs font-semibold store-primary hover:underline">
                      Read Story →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
