import React from "react";
import { Link } from "react-router-dom";
import { resolveMediaUrl } from "../lib/api";
import HomepageSectionTitle, { SectionCta } from "./HomepageSectionTitle";
import { ctaLabel } from "../lib/cta";

const safePath = (value, fallback) =>
  typeof value === "string" && (value.startsWith("/") || /^https?:\/\//i.test(value)) ? value : fallback;

/** Homepage stories section fed by the existing blog system (published posts, newest first). */
export default function BlogPreviewSection({ section }) {
  const s = section.settings || {};
  const posts = (Array.isArray(section.posts) ? section.posts : []).slice(0, s.limit || 3);
  const showEmpty = posts.length === 0;
  if (showEmpty && s.showEmptyState !== true) return null;
  const viewAll = safePath(s.viewAllUrl, "/blog");
  const date = (value) => new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <section data-testid="blog-section" className="mx-auto max-w-7xl px-4 sm:px-8">
      <HomepageSectionTitle align={s.headingAlign || "CENTER"} eyebrow={s.eyebrow} title={s.title || "Stories from Tushaqsa"} subtitle={s.subtitle} className="mb-10 sm:mb-12" />
      {showEmpty ? (
        <div data-testid="blog-empty" className="mx-auto max-w-xl rounded-2xl border store-border store-surface px-6 py-12 text-center">
          <p className="font-serif-display text-lg store-text">{s.emptyStateMessage || "Stories coming soon."}</p>
        </div>
      ) : (
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
        {posts.map((post) => (
          <Link key={post.id} to={`/blog/${post.slug}`} data-testid="blog-card" className="group flex w-[80%] max-w-sm shrink-0 snap-start flex-col overflow-hidden sm:w-auto sm:max-w-none sm:shrink rounded-2xl border store-border store-surface transition hover:shadow-lg">
            <div className="aspect-[16/10] overflow-hidden store-surface">
              {post.featuredImage ? (
                <img src={resolveMediaUrl(post.featuredImage)} alt={post.title} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              ) : (
                <div data-testid="blog-image-placeholder" aria-hidden="true" className="h-full w-full bg-black/5" />
              )}
            </div>
            <div className="flex flex-1 flex-col p-5">
              <div className="flex flex-wrap gap-x-3 text-[11px] uppercase tracking-wider store-muted">
                {post.category && <span data-testid="blog-category" className="store-primary">{post.category}</span>}
                {s.showDate !== false && <span>{date(post.publishDate)}</span>}
                {s.showReadingTime !== false && <span>{post.readingMinutes} min read</span>}
              </div>
              <h3 className="mt-2 break-words font-serif-display text-lg font-bold store-text group-hover:store-primary">{post.title}</h3>
              {s.showExcerpt !== false && post.excerpt && <p className="mt-2 line-clamp-3 text-xs leading-relaxed store-muted">{post.excerpt}</p>}
              {s.showAuthor !== false && post.author && <p className="mt-3 text-xs font-semibold store-text">By {post.author}</p>}
            </div>
          </Link>
        ))}
      </div>
      )}
      {s.showViewAll !== false && <SectionCta to={viewAll} align={s.headingAlign === "LEFT" ? "LEFT" : "CENTER"}>{ctaLabel(s.viewAllLabel, "Read Journal")}</SectionCta>}
    </section>
  );
}
