import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { fetchBlogPosts, resolveProductImageUrl } from "../lib/api";

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
    <div className="bg-white min-h-screen py-12 px-5 sm:px-8 space-y-12 max-w-7xl mx-auto animate-fade-in">
      {/* Header Section */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">Aadya Lifestyle Journal</span>
        <h1 className="font-serif-display text-4xl sm:text-5xl text-charcoal">Living & Craft Stories</h1>
        <p className="text-sm text-charcoal-soft leading-relaxed">
          Explore artisanal inspirations, slow living philosophy, decor edits, and home styling guides curated by Aadya Society.
        </p>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap justify-center gap-2 border-b border-charcoal/10 pb-6">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-full text-xs font-medium transition ${
              selectedCategory === cat
                ? "bg-terracotta text-white font-semibold shadow-sm"
                : "bg-ivory text-charcoal-soft hover:bg-charcoal/5"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center text-xs text-charcoal-soft animate-pulse">
          Curating journal stories...
        </div>
      ) : posts.length === 0 ? (
        <div className="py-20 text-center text-sm text-charcoal-soft">
          No journal articles found in this category.
        </div>
      ) : (
        <>
          {/* Featured Hero Card */}
          {featuredPost && (
            <div className="rounded-3xl overflow-hidden border border-charcoal/10 bg-ivory grid grid-cols-1 lg:grid-cols-2 gap-8 p-6 sm:p-10 shadow-sm items-center">
              {featuredPost.featuredImage && (
                <div className="aspect-[16/10] w-full rounded-2xl overflow-hidden bg-white border border-charcoal/5">
                  <img
                    src={resolveProductImageUrl(featuredPost.featuredImage)}
                    alt={featuredPost.title}
                    className="w-full h-full object-cover hover:scale-105 transition duration-500"
                  />
                </div>
              )}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-terracotta/10 text-terracotta">
                    {featuredPost.category || "Featured Story"}
                  </span>
                  <span className="text-xs text-charcoal-soft">
                    {new Date(featuredPost.publishDate || featuredPost.createdAt).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                      year: "numeric"
                    })}
                  </span>
                </div>
                <h2 className="font-serif-display text-2xl sm:text-4xl text-charcoal leading-tight">
                  <Link to={`/blog/${featuredPost.slug}`} className="hover:text-terracotta transition">
                    {featuredPost.title}
                  </Link>
                </h2>
                {featuredPost.excerpt && (
                  <p className="text-sm text-charcoal-soft leading-relaxed">
                    {featuredPost.excerpt}
                  </p>
                )}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-charcoal font-medium">By {featuredPost.author || "Aadya Editorial"}</span>
                  <Link
                    to={`/blog/${featuredPost.slug}`}
                    className="rounded-xl bg-terracotta px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-terracotta/90 transition"
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
                <article key={post.id} className="group flex flex-col justify-between space-y-4 rounded-2xl border border-charcoal/10 p-5 bg-white shadow-sm hover:shadow-md transition">
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
                      <span className="text-[10px] font-bold uppercase tracking-wider text-terracotta">
                        {post.category || "Journal"}
                      </span>
                      <span className="text-charcoal-soft/40">•</span>
                      <span className="text-[11px] text-charcoal-soft">
                        {new Date(post.publishDate || post.createdAt).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric"
                        })}
                      </span>
                    </div>
                    <h3 className="font-serif-display text-xl text-charcoal group-hover:text-terracotta transition">
                      <Link to={`/blog/${post.slug}`}>{post.title}</Link>
                    </h3>
                    {post.excerpt && (
                      <p className="text-xs text-charcoal-soft line-clamp-3 leading-relaxed">{post.excerpt}</p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-charcoal/5 flex items-center justify-between">
                    <span className="text-[11px] text-charcoal font-medium">{post.author || "Aadya Editorial"}</span>
                    <Link to={`/blog/${post.slug}`} className="text-xs font-semibold text-terracotta hover:underline">
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
