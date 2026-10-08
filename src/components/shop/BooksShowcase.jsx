import React from "react";
import { Link } from "react-router-dom";
import BookCard from "./BookCard";
import HomepageSectionTitle from "../HomepageSectionTitle";
import { resolveMediaUrl } from "../../lib/api";
import { formatInr } from "../../lib/format";

const cleanAuthor = (a) => (typeof a === "string" ? a.replace(/\s*\(demo sample\)\s*$/i, "").trim() : "");
const byNewest = (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
const excerpt = (text, max = 190) => (text && text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, "")}…` : text || "");

/**
 * Splits real books into showcase modules. Pure so it can be tested: each module only exists when it
 * has books, and a book is not repeated across the Featured / New / Editor / Popular rows.
 */
export function buildBookModules(books = []) {
  const list = [...books].filter((b) => b && b.isActive !== false);
  const used = new Set();
  const take = (candidates, n) => {
    const out = [];
    for (const b of candidates) {
      if (out.length >= n) break;
      if (!used.has(b.id)) { used.add(b.id); out.push(b); }
    }
    return out;
  };
  const newest = [...list].sort(byNewest);
  const featured = take([...list.filter((b) => b.isFeatured).sort(byNewest), ...newest], 1)[0] || null;
  // Explicitly flagged rows claim their books first; "New Releases" then fills from what is left.
  const editorsPicks = take(list.filter((b) => b.isFeatured).sort(byNewest), 4);
  const popular = take(list.filter((b) => b.isBestSeller || b.isTrending), 4);
  const newReleases = take([...list.filter((b) => b.isNewArrival), ...newest], 4);
  return { featured, newReleases, editorsPicks, popular };
}

function Row({ eyebrow, title, books, testId }) {
  if (!books.length) return null;
  return (
    <section data-testid={testId} className="mx-auto max-w-7xl px-4 sm:px-8">
      <HomepageSectionTitle align="CENTER" eyebrow={eyebrow} title={title} className="mb-8 sm:mb-10" />
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
        {books.map((b) => <BookCard key={b.id} product={b} />)}
      </div>
    </section>
  );
}

/** Premium bookstore modules shown above the full books catalog. Renders nothing without books. */
export default function BooksShowcase({ books = [], themes = [] }) {
  if (!books.length) return null;
  const { featured, newReleases, editorsPicks, popular } = buildBookModules(books);
  const cover = featured && (featured.images?.[0]?.url || featured.images?.[0] || featured.image);
  const author = featured && cleanAuthor(featured.bookDetail?.author);
  return (
    <div data-testid="books-showcase" className="space-y-14 sm:space-y-20">
      {themes.length > 0 && (
        <section data-testid="books-themes" className="mx-auto max-w-7xl px-4 sm:px-8">
          <HomepageSectionTitle align="CENTER" eyebrow="Browse by theme" title="Find your next read" className="mb-6" />
          <div className="flex flex-wrap justify-center gap-2.5">
            {themes.map((t) => (
              <Link key={t.id} to={`/shop/category/${t.slug}`} data-testid="books-theme-chip" className="rounded-full border border-[var(--theme-border)] px-5 py-2 text-xs font-medium uppercase tracking-[0.16em] store-text transition hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)]">{t.name}</Link>
            ))}
          </div>
        </section>
      )}

      {featured && (
        <section data-testid="books-featured" className="mx-auto max-w-7xl px-4 sm:px-8">
          <div className="grid items-center gap-8 overflow-hidden rounded-2xl store-surface p-6 sm:p-10 md:grid-cols-12 md:gap-12">
            <Link to={`/shop/${featured.slug}`} className="mx-auto w-48 shrink-0 sm:w-60 md:col-span-4 md:w-full md:max-w-[17rem]">
              <div className="aspect-[2/3] overflow-hidden rounded-[3px] shadow-[0_24px_40px_-18px_rgba(43,39,35,0.55)]">
                {cover && <img src={resolveMediaUrl(cover)} alt={`${featured.name} cover`} className="h-full w-full object-cover" />}
              </div>
            </Link>
            <div className="text-center md:col-span-8 md:text-left">
              <span className="text-[11px] font-medium uppercase tracking-[0.3em] store-primary">Featured book</span>
              <h2 className="mt-3 font-serif-display text-3xl font-light leading-tight store-text sm:text-4xl">{featured.name}</h2>
              {author && <p className="mt-2 text-sm italic store-muted">{author}</p>}
              <p className="mx-auto mt-4 max-w-xl text-sm font-light leading-relaxed store-muted md:mx-0">{excerpt(featured.shortDescription || featured.description)}</p>
              <p className="mt-5 text-lg font-medium store-primary">{formatInr(Number(featured.salePrice ?? featured.price))}</p>
              <Link to={`/shop/${featured.slug}`} className="mt-6 inline-flex items-center gap-3 border border-[var(--theme-primary)] px-8 py-3 text-[11px] font-medium uppercase tracking-[0.2em] store-primary transition hover:bg-[var(--theme-primary)] hover:text-white">View book <span aria-hidden="true">&rarr;</span></Link>
            </div>
          </div>
        </section>
      )}

      <Row testId="books-new" eyebrow="Just arrived" title="New Releases" books={newReleases} />
      <Row testId="books-editors" eyebrow="Hand-picked" title="Editor’s Picks" books={editorsPicks} />
      <Row testId="books-popular" eyebrow="Reader favourites" title="Popular Reads" books={popular} />
    </div>
  );
}
