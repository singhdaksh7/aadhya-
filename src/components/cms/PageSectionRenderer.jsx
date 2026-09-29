import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { fetchBlogPosts, fetchFaqs, resolveProductImageUrl } from "../../lib/api";
import RichTextRenderer from "./RichTextRenderer";

export default function PageSectionRenderer({ sections = [] }) {
  if (!sections || sections.length === 0) return null;

  return (
    <div className="space-y-16 py-6">
      {sections.map((sec) => (
        <SectionItem key={sec.id || sec.type} section={sec} />
      ))}
    </div>
  );
}

function SectionItem({ section }) {
  const { type, settings = {}, content = {} } = section;

  switch (type) {
    case "HERO":
      return (
        <div className="relative rounded-3xl overflow-hidden store-surface border store-border p-8 sm:p-14 flex flex-col md:flex-row items-center gap-8 shadow-sm">
          <div className="flex-1 space-y-4">
            {content.eyebrow && (
              <span className="text-xs font-semibold uppercase tracking-widest store-primary">{content.eyebrow}</span>
            )}
            <h2 className="font-serif-display text-3xl sm:text-4xl store-text">{content.title}</h2>
            {content.body && <p className="text-sm store-muted leading-relaxed">{content.body}</p>}
            {content.buttonText && content.buttonUrl && (
              <Link
                to={content.buttonUrl}
                className="inline-block rounded-xl store-bg-primary px-6 py-3 text-xs font-semibold text-white shadow-sm store-primary-hover transition"
              >
                {content.buttonText}
              </Link>
            )}
          </div>
          {content.imageUrl && (
            <div className="w-full md:w-1/2 aspect-video rounded-2xl overflow-hidden border store-border shadow-sm">
              <img src={resolveProductImageUrl(content.imageUrl)} alt="" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      );

    case "IMAGE_TEXT":
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center py-4">
          {content.imageUrl && (
            <div className="aspect-square rounded-2xl overflow-hidden border store-border shadow-sm">
              <img src={resolveProductImageUrl(content.imageUrl)} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="space-y-4">
            {content.eyebrow && (
              <span className="text-xs font-semibold uppercase tracking-widest store-primary">{content.eyebrow}</span>
            )}
            <h3 className="font-serif-display text-2xl sm:text-3xl store-text">{content.title}</h3>
            {content.body && <RichTextRenderer content={content.body} />}
          </div>
        </div>
      );

    case "RICH_TEXT":
      return (
        <div className="store-surface p-8 sm:p-12 rounded-3xl border store-border shadow-sm">
          {content.title && <h3 className="font-serif-display text-2xl store-text mb-6">{content.title}</h3>}
          <RichTextRenderer content={content.body || content.html || ""} />
        </div>
      );

    case "CTA":
      return (
        <div className="rounded-3xl store-bg-secondary-soft p-8 sm:p-12 text-center space-y-4 border border-[var(--theme-secondary)]/20">
          <h3 className="font-serif-display text-2xl sm:text-3xl store-secondary">{content.title || settings.title}</h3>
          {content.body && <p className="text-sm store-secondary max-w-xl mx-auto">{content.body}</p>}
          {content.buttonText && content.buttonUrl && (
            <Link
              to={content.buttonUrl}
              className="inline-block rounded-xl store-bg-primary px-6 py-3 text-xs font-semibold text-white shadow-sm store-primary-hover transition"
            >
              {content.buttonText}
            </Link>
          )}
        </div>
      );

    case "BLOG_PREVIEW":
      return <BlogPreviewSection settings={settings} content={content} />;

    case "FAQ_PREVIEW":
      return <FaqPreviewSection settings={settings} content={content} />;

    default:
      return null;
  }
}

function BlogPreviewSection({ settings = {}, content = {} }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBlogPosts({ limit: settings.limit || 3, featuredOnly: settings.featuredOnly })
      .then((res) => setPosts(res.items || res.data || []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading || posts.length === 0) return null;

  return (
    <div className="space-y-6 py-4">
      <div className="flex justify-between items-end border-b store-border pb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest store-primary">Editorial Journal</span>
          <h3 className="font-serif-display text-2xl store-text">{content.title || settings.title || "Latest Stories"}</h3>
        </div>
        <Link to={settings.viewAllUrl || "/blog"} className="text-xs font-semibold store-primary hover:underline">
          View All Stories →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {posts.map((post) => (
          <Link key={post.id} to={`/blog/${post.slug}`} className="group space-y-3">
            {post.featuredImage && (
              <div className="aspect-[4/3] rounded-2xl overflow-hidden store-surface border store-border">
                <img
                  src={resolveProductImageUrl(post.featuredImage)}
                  alt={post.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />
              </div>
            )}
            <span className="text-[10px] font-semibold uppercase tracking-wider store-primary">{post.category}</span>
            <h4 className="font-serif-display text-lg store-text group-hover:store-primary transition">{post.title}</h4>
            {post.excerpt && <p className="text-xs store-muted line-clamp-2">{post.excerpt}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}

function FaqPreviewSection({ settings = {}, content = {} }) {
  const [faqs, setFaqs] = useState([]);
  const [openIdx, setOpenIdx] = useState(0);

  useEffect(() => {
    fetchFaqs({ limit: settings.limit || 5 })
      .then((res) => {
        const categories = res.data || res.items || res || [];
        const items = categories.flatMap((c) => c.items || []);
        setFaqs(items.slice(0, settings.limit || 5));
      })
      .catch(() => setFaqs([]));
  }, []);

  if (faqs.length === 0) return null;

  return (
    <div className="space-y-6 py-4">
      <div className="flex justify-between items-end border-b store-border pb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest store-primary">Customer Help</span>
          <h3 className="font-serif-display text-2xl store-text">{content.title || settings.title || "Frequently Asked Questions"}</h3>
        </div>
        <Link to={settings.viewAllUrl || "/faq"} className="text-xs font-semibold store-primary hover:underline">
          View All FAQs →
        </Link>
      </div>

      <div className="space-y-3">
        {faqs.map((faq, idx) => {
          const isOpen = openIdx === idx;
          return (
            <div key={faq.id} className="rounded-2xl border store-border store-surface overflow-hidden shadow-sm">
              <button
                onClick={() => setOpenIdx(isOpen ? -1 : idx)}
                className="w-full px-6 py-4 text-left font-semibold text-sm store-text flex justify-between items-center hover:bg-black/5 transition"
              >
                <span>{faq.question}</span>
                <span className={`store-primary text-lg transition-transform ${isOpen ? "rotate-45" : ""}`}>+</span>
              </button>
              {isOpen && (
                <div className="px-6 pb-5 pt-1 text-xs store-muted border-t store-border store-surface">
                  <RichTextRenderer content={faq.answer} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
