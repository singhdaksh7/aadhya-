import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchBlogPostBySlug, fetchBlogPosts, resolveProductImageUrl } from "../lib/api";
import RichTextRenderer from "../components/cms/RichTextRenderer";
import NotFound from "./NotFound";

export default function BlogDetail() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [relatedPosts, setRelatedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    loadPost();
  }, [slug]);

  const loadPost = async () => {
    try {
      setLoading(true);
      setNotFound(false);
      const res = await fetchBlogPostBySlug(slug);
      const data = res.data || res;
      setPost(data);

      // Load related posts from same category
      if (data.category) {
        const relRes = await fetchBlogPosts({ category: data.category, limit: 3 });
        const relList = (relRes.items || relRes.data || []).filter((p) => p.id !== data.id);
        setRelatedPosts(relList);
      }
    } catch (err) {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-20 text-center animate-pulse space-y-4">
        <div className="h-4 w-24 bg-charcoal/10 rounded mx-auto" />
        <div className="h-10 w-3/4 bg-charcoal/10 rounded mx-auto" />
        <div className="h-64 w-full bg-charcoal/5 rounded-3xl" />
      </div>
    );
  }

  if (notFound || !post) {
    return <NotFound />;
  }

  const featuredImgUrl = resolveProductImageUrl(post.featuredImage);

  return (
    <div className="bg-white min-h-screen py-12 px-5 sm:px-8 animate-fade-in">
      <article className="max-w-3xl mx-auto space-y-8">
        {/* Back Button */}
        <div>
          <Link to="/blog" className="inline-flex items-center gap-2 text-xs font-semibold text-charcoal-soft hover:text-terracotta transition">
            ← Back to Journal
          </Link>
        </div>

        {/* Article Header */}
        <header className="space-y-4 text-center border-b border-charcoal/10 pb-8">
          <div className="flex items-center justify-center gap-3">
            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-terracotta/10 text-terracotta">
              {post.category || "Journal"}
            </span>
            <span className="text-xs text-charcoal-soft">
              {new Date(post.publishDate || post.createdAt).toLocaleDateString("en-IN", {
                month: "long",
                day: "numeric",
                year: "numeric"
              })}
            </span>
          </div>

          <h1 className="font-serif-display text-3xl sm:text-5xl text-charcoal leading-tight">
            {post.title}
          </h1>

          {post.excerpt && (
            <p className="text-base sm:text-lg text-charcoal-soft leading-relaxed max-w-2xl mx-auto">
              {post.excerpt}
            </p>
          )}

          <div className="pt-2 text-xs font-medium text-charcoal">
            Written by <span className="font-semibold text-terracotta">{post.author || "Aadya Editorial"}</span>
          </div>
        </header>

        {/* Featured Image */}
        {featuredImgUrl && (
          <div className="rounded-3xl overflow-hidden shadow-sm border border-charcoal/10 max-h-[480px] w-full">
            <img src={featuredImgUrl} alt={post.title} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Article Body */}
        <div className="py-4">
          <RichTextRenderer content={post.content} />
        </div>

        {/* Article Footer & Tags */}
        {post.tags && (
          <footer className="border-t border-b border-charcoal/10 py-6 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase text-charcoal-soft tracking-wider mr-2">Tags:</span>
            {(Array.isArray(post.tags) ? post.tags : [post.tags]).map((tag) => (
              <span key={tag} className="px-3 py-1 rounded-full bg-ivory text-xs text-charcoal font-medium border border-charcoal/10">
                #{tag}
              </span>
            ))}
          </footer>
        )}

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <section className="pt-12 space-y-6">
            <h3 className="font-serif-display text-2xl text-charcoal">More Stories in {post.category}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {relatedPosts.map((rel) => (
                <Link key={rel.id} to={`/blog/${rel.slug}`} className="group space-y-3 rounded-2xl border border-charcoal/10 p-4 bg-ivory/50 hover:bg-white transition">
                  {rel.featuredImage && (
                    <div className="aspect-video rounded-xl overflow-hidden bg-white border border-charcoal/5">
                      <img
                        src={resolveProductImageUrl(rel.featuredImage)}
                        alt={rel.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    </div>
                  )}
                  <h4 className="font-serif-display text-base text-charcoal group-hover:text-terracotta transition">
                    {rel.title}
                  </h4>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </div>
  );
}
