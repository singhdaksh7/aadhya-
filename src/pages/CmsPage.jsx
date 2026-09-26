import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchPageBySlug, resolveProductImageUrl } from "../lib/api";
import RichTextRenderer from "../components/cms/RichTextRenderer";
import PageSectionRenderer from "../components/cms/PageSectionRenderer";
import NotFound from "./NotFound";

export default function CmsPage({ overrideSlug }) {
  const { slug: routeSlug } = useParams();
  const slug = overrideSlug || routeSlug;
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (slug) {
      loadPage();
    }
  }, [slug]);

  const loadPage = async () => {
    try {
      setLoading(true);
      setNotFound(false);
      const res = await fetchPageBySlug(slug);
      const data = res.data || res;
      setPage(data);
    } catch (err) {
      if (err.status === 404) {
        setNotFound(true);
      } else {
        setNotFound(true);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-20 text-center animate-pulse space-y-4">
        <div className="h-4 w-24 bg-charcoal/10 rounded mx-auto" />
        <div className="h-8 w-64 bg-charcoal/10 rounded mx-auto" />
        <div className="h-40 w-full bg-charcoal/5 rounded-2xl" />
      </div>
    );
  }

  if (notFound || !page) {
    return <NotFound />;
  }

  const featuredImgUrl = resolveProductImageUrl(page.featuredImage);

  return (
    <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="space-y-3 border-b border-charcoal/10 pb-6">
        <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">Aadya Storefront</span>
        <h1 className="font-serif-display text-3xl sm:text-5xl text-charcoal leading-tight">{page.name}</h1>
        {page.excerpt && (
          <p className="text-sm sm:text-base text-charcoal-soft leading-relaxed max-w-2xl">
            {page.excerpt}
          </p>
        )}
      </div>

      {/* Featured Header Image */}
      {featuredImgUrl && (
        <div className="rounded-2xl overflow-hidden shadow-sm border border-charcoal/10 max-h-96 w-full">
          <img src={featuredImgUrl} alt={page.name} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Content Rendering */}
      {page.pageType === "LANDING" && page.sections && page.sections.length > 0 ? (
        <PageSectionRenderer sections={page.sections} />
      ) : (
        <RichTextRenderer content={page.content} className="py-2" />
      )}
    </div>
  );
}
