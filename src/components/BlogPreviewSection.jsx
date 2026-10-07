import React from "react";
import { Link } from "react-router-dom";
import { resolveMediaUrl } from "../lib/api";
import HomepageSectionTitle, { SectionCta } from "./HomepageSectionTitle";

const safePath = (value, fallback) =>
  typeof value === "string" && (value.startsWith("/") || /^https?:\/\//i.test(value)) ? value : fallback;

/** Homepage stories section fed by the existing blog system (published posts, newest first). */
export default function BlogPreviewSection({ section }) {
  const s = section.settings || {};
  const posts = (Array.isArray(section.posts) ? section.posts : []).slice(0, s.limit || 3);
  if (posts.length === 0) return null;
  const viewAll = safePath(s.viewAllUrl, "/blog");
  const date = (value) => new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <section data-testid="blog-section" className="mx-auto max-w-7xl px-4 sm:px-8">
      <HomepageSectionTitle align={s.headingAlign || "CENTER"} eyebrow={s.eyebrow} title={s.title || "Stories from Aadya"} className="mb-10 sm:mb-12" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <Link key={post.id} to={`/blog/${post.slug}`} data-testid="blog-card" className="group flex flex-col overflow-hidden rounded-2xl border store-border store-surface transition hover:shadow-lg">
            {post.featuredImage && (
              <div className="aspect-[16/10] overflow-hidden">
                <img src={resolveMediaUrl(post.featuredImage)} alt={post.title} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              </div>
            )}
            <div className="flex flex-1 flex-col p-5">
              <div className="flex flex-wrap gap-x-3 text-[11px] uppercase tracking-wider store-muted">
                {s.showDate !== false && <span>{date(post.publishDate)}</span>}
                {s.showReadingTime !== false && <span>{post.readingMinutes} min read</span>}
              </div>
              <h3 className="mt-2 font-serif-display text-lg font-bold store-text group-hover:store-primary">{post.title}</h3>
              {s.showExcerpt !== false && post.excerpt && <p className="mt-2 line-clamp-3 text-xs leading-relaxed store-muted">{post.excerpt}</p>}
              {s.showAuthor !== false && post.author && <p className="mt-3 text-xs font-semibold store-text">By {post.author}</p>}
            </div>
          </Link>
        ))}
      </div>
      {s.showViewAll !== false && <SectionCta to={viewAll} align={s.headingAlign === "LEFT" ? "LEFT" : "CENTER"}>View All Stories</SectionCta>}
    </section>
  );
}
