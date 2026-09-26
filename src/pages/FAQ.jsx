import React, { useState, useEffect } from "react";
import { fetchFaqs } from "../lib/api";
import RichTextRenderer from "../components/cms/RichTextRenderer";
import { IconChevronDown } from "../components/icons";

export default function FAQ() {
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [openId, setOpenId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFaqs();
  }, []);

  const loadFaqs = async () => {
    try {
      setLoading(true);
      const res = await fetchFaqs();
      const loaded = res.data || res.items || res || [];
      setCategories(loaded);
    } catch (err) {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const allCategoriesList = ["All", ...categories.map((c) => c.name)];

  // Flatten items for "All" or filter by active category name
  const displayItems = activeCategory === "All"
    ? categories.flatMap((c) => (c.items || []).map((item) => ({ ...item, categoryName: c.name })))
    : (categories.find((c) => c.name === activeCategory)?.items || []).map((item) => ({ ...item, categoryName: activeCategory }));

  return (
    <div className="bg-white min-h-screen py-12 px-5 sm:px-8 max-w-4xl mx-auto space-y-12 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">Customer Help & Support</span>
        <h1 className="font-serif-display text-3xl sm:text-5xl text-charcoal">Frequently Asked Questions</h1>
        <p className="text-sm text-charcoal-soft leading-relaxed max-w-xl mx-auto">
          Find instant answers regarding shipping timelines, returns, handcrafted minerals, order tracking, and bespoke gifting.
        </p>
      </div>

      {/* Category Pills */}
      {categories.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 border-b border-charcoal/10 pb-6">
          {allCategoriesList.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                setOpenId(null);
              }}
              className={`px-4 py-2 rounded-full text-xs font-medium transition ${
                activeCategory === cat
                  ? "bg-terracotta text-white font-semibold shadow-sm"
                  : "bg-ivory text-charcoal-soft border border-charcoal/10 hover:border-terracotta/40 hover:text-charcoal"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Accordion Questions */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-16 text-center text-xs text-charcoal-soft animate-pulse">
            Loading help center FAQs...
          </div>
        ) : displayItems.length === 0 ? (
          <div className="py-16 text-center text-sm text-charcoal-soft border border-dashed border-charcoal/15 rounded-2xl">
            No active FAQ questions found.
          </div>
        ) : (
          displayItems.map((item) => {
            const isOpen = openId === item.id;
            return (
              <div
                key={item.id}
                className={`rounded-2xl border transition shadow-sm overflow-hidden ${
                  isOpen ? "border-terracotta bg-ivory/30" : "border-charcoal/10 bg-white hover:border-charcoal/25"
                }`}
              >
                <button
                  onClick={() => setOpenId(isOpen ? null : item.id)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left transition"
                >
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-terracotta/80 block">
                      {item.categoryName}
                    </span>
                    <span className="text-sm font-semibold text-charcoal leading-snug">{item.question}</span>
                  </div>
                  <span
                    className={`shrink-0 text-terracotta transition-transform duration-300 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  >
                    <IconChevronDown />
                  </span>
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 pt-1 text-xs text-charcoal-soft border-t border-charcoal/5 bg-white/60">
                    <RichTextRenderer content={item.answer} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Support Callout */}
      <div className="rounded-3xl bg-ivory p-8 text-center border border-charcoal/10 space-y-3">
        <h3 className="font-serif-display text-xl text-charcoal">Have a specific question not listed here?</h3>
        <p className="text-xs text-charcoal-soft">
          Our concierge support team is available Monday through Saturday to assist with bespoke orders and shipping queries.
        </p>
        <div>
          <a
            href="/contact"
            className="inline-block rounded-xl bg-terracotta px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-terracotta/90 transition"
          >
            Contact Concierge →
          </a>
        </div>
      </div>
    </div>
  );
}
