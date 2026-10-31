import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchOffers, fetchWhatsNew } from "../lib/api";
import { useSiteSettings } from "../hooks/useSiteSettings";
import { canonicalUrl } from "../lib/seo";
import { LoadingNotice, ErrorNotice, EmptyNotice } from "../components/StateNotice";
import OfferCard from "../components/offers/OfferCard";
import WhatsNewCard from "../components/offers/WhatsNewCard";

const TABS = [
  { id: "offers", label: "Offers" },
  { id: "whats-new", label: "What's New" },
];

export default function OffersPage() {
  const settings = useSiteSettings();
  const storeName = settings.general?.storeName || "Tushaqsa";
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => (TABS.some((t) => t.id === searchParams.get("tab")) ? searchParams.get("tab") : "offers"));
  const [offers, setOffers] = useState({ status: "loading", items: [] });
  const [news, setNews] = useState({ status: "loading", items: [] });

  useEffect(() => {
    let active = true;
    fetchOffers()
      .then((res) => active && setOffers({ status: "ready", items: res?.data || [] }))
      .catch(() => active && setOffers({ status: "error", items: [] }));
    fetchWhatsNew()
      .then((res) => active && setNews({ status: "ready", items: res?.data || [] }))
      .catch(() => active && setNews({ status: "error", items: [] }));
    return () => {
      active = false;
    };
  }, []);

  const current = tab === "offers" ? offers : news;

  return (
    <div className="store-bg min-h-screen animate-fade-in">
      <title>{`Offers & What's New | ${storeName}`}</title>
      <meta name="description" content="Current coupon codes, festive offers and the latest arrivals from our artisans." />
      <link rel="canonical" href={canonicalUrl("/offers")} />
      <div className="mx-auto max-w-5xl space-y-8 px-5 py-12 sm:px-8">
        <div className="space-y-3 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest store-primary">Offers & Updates</span>
          <h1 className="font-serif-display text-3xl store-text sm:text-5xl">Offers & What's New</h1>
          <p className="mx-auto max-w-xl text-sm leading-relaxed store-muted">
            Copy a code, apply it at checkout, and explore what our artisans have just brought in.
          </p>
        </div>

        <div role="tablist" aria-label="Offers sections" className="mx-auto flex w-fit gap-1 rounded-full border border-[var(--theme-border)] bg-white p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition ${tab === t.id ? "bg-green text-ivory" : "text-charcoal-soft hover:text-charcoal"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {current.status === "loading" && <LoadingNotice />}
        {current.status === "error" && <ErrorNotice message="Unable to load this right now. Please try again shortly." />}
        {current.status === "ready" && tab === "offers" && (
          offers.items.length === 0 ? (
            <EmptyNotice message="No offers are running right now. Check back soon." />
          ) : (
            <div className="space-y-5">
              {offers.items.map((o) => <OfferCard key={o.code} offer={o} />)}
            </div>
          )
        )}
        {current.status === "ready" && tab === "whats-new" && (
          news.items.length === 0 ? (
            <EmptyNotice message="Nothing new to show yet. Check back soon." />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {news.items.map((i) => <WhatsNewCard key={i.id} item={i} />)}
            </div>
          )
        )}
      </div>
    </div>
  );
}
