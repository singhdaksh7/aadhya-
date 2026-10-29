import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { fetchPageBySlug, fetchProducts, resolveProductImageUrl } from "../lib/api";
import { useSiteSettings } from "../hooks/useSiteSettings";
import { canonicalUrl } from "../lib/seo";
import {
  GiftingHeroSection,
  GiftsByOccasionSection,
  CuratedStoriesSection,
  GiftsByFestivalSection,
  GiftingBenefitsSection,
  GiftsByCraftSection,
  FeaturedGiftsSection,
  GiftsByBudgetSection,
  GiftingSeoSection,
  GiftingFaqSection,
} from "../components/gifting/GiftingSections";
import { DEFAULT_GIFTING_CONTENT, DEFAULT_GIFTING_PAGE_SECTIONS } from "../lib/defaultGiftingContent";
import { MOCK_PRODUCTS } from "../mocks/products";

export default function GiftingPage() {
  const settings = useSiteSettings();
  const storeName = settings.general?.storeName || "Tushaqsa";

  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [featuredProducts, setFeaturedProducts] = useState([]);

  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.all([
      fetchPageBySlug("gifting").catch(() => null),
      fetchProducts({ limit: 8, isFeatured: true }).catch(() => null),
    ])
      .then(([pageRes, prodRes]) => {
        if (!active) return;
        const pageData = pageRes?.data || pageRes;
        if (pageData?.sections && pageData.sections.length > 0) {
          setPage(pageData);
        } else {
          // Fallback to default gifting page structure
          setPage({
            name: "Artisan Gifting",
            slug: "gifting",
            seoTitle: `Thoughtful Gifting | Handcrafted Decor & Curated Keepsakes | ${storeName}`,
            seoDescription: "Discover handcrafted gifts for housewarming, weddings, anniversaries and festivals. Heirloom brass, raw ceramics, and mindful objects made in India.",
            sections: DEFAULT_GIFTING_PAGE_SECTIONS,
          });
        }

        const rawProds = prodRes?.data || prodRes?.items || prodRes || [];
        if (Array.isArray(rawProds) && rawProds.length > 0) {
          setFeaturedProducts(rawProds);
        } else {
          // Fallback to mock gifting products
          const giftingMocks = MOCK_PRODUCTS.filter((p) => p.collectionSlug === "festive-gifting" || p.categorySlug === "home-decor").slice(0, 4);
          setFeaturedProducts(giftingMocks);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [storeName]);

  const sections = page?.sections && page.sections.length > 0 ? page.sections : DEFAULT_GIFTING_PAGE_SECTIONS;
  const enabledSections = sections.filter((s) => s.isEnabled !== false && s.isActive !== false);

  const title = page?.seoTitle || `Artisan Gifting | ${storeName}`;
  const description = page?.seoDescription || "Discover thoughtful handcrafted gifts for life's meaningful moments.";
  const featuredImg = resolveProductImageUrl(page?.featuredImage);

  if (loading && !page) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-8 py-20 text-center animate-pulse space-y-8" data-testid="gifting-page-loading">
        <div className="h-64 sm:h-96 w-full rounded-3xl bg-charcoal/5" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-2xl bg-charcoal/5" />
          ))}
        </div>
      </div>
    );
  }

  const renderSection = (sec) => {
    switch (sec.type) {
      case "GIFTING_HERO":
        return <GiftingHeroSection key={sec.id || sec.type} section={sec} />;
      case "GIFTS_BY_OCCASION":
        return <GiftsByOccasionSection key={sec.id || sec.type} section={sec} />;
      case "CURATED_STORIES":
        return <CuratedStoriesSection key={sec.id || sec.type} section={sec} />;
      case "GIFTS_BY_FESTIVAL":
        return <GiftsByFestivalSection key={sec.id || sec.type} section={sec} />;
      case "GIFTING_BENEFITS":
        return <GiftingBenefitsSection key={sec.id || sec.type} section={sec} />;
      case "GIFTS_BY_CRAFT":
        return <GiftsByCraftSection key={sec.id || sec.type} section={sec} />;
      case "FEATURED_GIFTS":
        return <FeaturedGiftsSection key={sec.id || sec.type} section={sec} products={featuredProducts} />;
      case "GIFTS_BY_BUDGET":
        return <GiftsByBudgetSection key={sec.id || sec.type} section={sec} />;
      case "GIFTING_SEO":
        return <GiftingSeoSection key={sec.id || sec.type} section={sec} />;
      case "GIFTING_FAQ":
        return <GiftingFaqSection key={sec.id || sec.type} section={sec} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen store-bg" data-testid="gifting-page">
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl("/gifting")} />
      {featuredImg && <meta property="og:image" content={featuredImg} />}

      {/* Structured Sections */}
      <div className="space-y-4 sm:space-y-8">
        {enabledSections.map((sec) => renderSection(sec))}
      </div>
    </div>
  );
}

