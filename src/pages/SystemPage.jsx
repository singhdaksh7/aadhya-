import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPageBySlug, resolveProductImageUrl } from "../lib/api";
import RichTextRenderer from "../components/cms/RichTextRenderer";
import { useSiteSettings } from "../hooks/useSiteSettings";
import { commercialContext, interpolateCommercial } from "../lib/commercialText";
import { canonicalUrl } from "../lib/seo";

// Storefront page whose copy is managed in Admin → Pages (slugs: about, shipping, returns, privacy, terms).
// Commercial facts inside the copy use placeholders such as {{freeShippingThreshold}} or
// {{returnWindowDays}}, which are filled from Store Settings so the page cannot drift from real behaviour.
export default function SystemPage({ slug, eyebrow = "Customer Information", fallbackTitle }) {
  const settings = useSiteSettings();
  const [page, setPage] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | missing

  useEffect(() => {
    let active = true;
    setState("loading");
    fetchPageBySlug(slug)
      .then((res) => {
        if (!active) return;
        const data = res?.data || res;
        if (data?.name) { setPage(data); setState("ready"); } else setState("missing");
      })
      .catch(() => { if (active) setState("missing"); });
    return () => { active = false; };
  }, [slug]);

  const ctx = commercialContext(settings);
  const storeName = settings.general?.storeName || "Aadya";

  if (state === "loading") {
    return (
      <div className="mx-auto max-w-4xl animate-pulse space-y-4 px-5 py-20 sm:px-8" data-testid="system-page-loading">
        <div className="h-4 w-24 rounded bg-charcoal/10" />
        <div className="h-8 w-64 rounded bg-charcoal/10" />
        <div className="h-40 w-full rounded-2xl bg-charcoal/5" />
      </div>
    );
  }

  if (state === "missing") {
    const title = fallbackTitle || "Page";
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-5 py-16 sm:px-8" data-testid="system-page-fallback">
        <title>{`${title} | ${storeName}`}</title>
        <span className="text-xs font-semibold uppercase tracking-widest store-primary">{eyebrow}</span>
        <h1 className="font-serif-display text-3xl store-text sm:text-4xl">{title}</h1>
        <p className="text-sm store-muted">This page is being updated. Please <Link to="/contact" className="underline">contact us</Link> if you need help in the meantime.</p>
      </div>
    );
  }

  const image = resolveProductImageUrl(page.featuredImage);
  const excerpt = interpolateCommercial(page.excerpt || "", ctx);
  const description = (page.seoDescription || excerpt || "").slice(0, 160);
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-5 py-16 sm:px-8" data-testid="system-page">
      <title>{`${page.seoTitle || page.name} | ${storeName}`}</title>
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={canonicalUrl(`/${slug}`)} />
      <header className="space-y-3 border-b store-border pb-6">
        <span className="text-xs font-semibold uppercase tracking-widest store-primary">{eyebrow}</span>
        <h1 className="font-serif-display text-3xl leading-tight store-text sm:text-5xl">{page.name}</h1>
        {excerpt && <p className="max-w-2xl text-sm leading-relaxed store-muted sm:text-base">{excerpt}</p>}
      </header>
      {image && (
        <div className="max-h-96 w-full overflow-hidden rounded-2xl border store-border">
          <img src={image} alt={page.name} className="h-full w-full object-cover" />
        </div>
      )}
      <RichTextRenderer content={interpolateCommercial(page.content || "", ctx)} className="py-2" />
    </div>
  );
}
