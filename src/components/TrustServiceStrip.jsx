import React from "react";

const FALLBACK_ITEMS = [
  { id: "trust-1", icon: "sparkles", title: "Thoughtfully Curated", description: "Hand-selected slow design objects for mindful living" },
  { id: "trust-2", icon: "badge", title: "Premium Quality", description: "Authentic materials from Indian craft clusters" },
  { id: "trust-3", icon: "home", title: "Styles for Every Space", description: "Proportions tailored for modern and traditional homes" },
  { id: "trust-4", icon: "shield", title: "Secure Payments", description: "100% encrypted checkout & Pan-India express dispatch" },
];

function TrustIcon({ name }) {
  const paths = { sparkles: "M5 3v4M3 5h4m9-2 2.286 6.857L24 12l-5.714 2.143L16 21l-2.286-6.857L8 12l5.714-2.143L16 3z", badge: "M9 12l2 2 4-4M7.8 4.7a3.4 3.4 0 004.4-.8 3.4 3.4 0 014.4 0 3.4 3.4 0 001.9.8 3.4 3.4 0 013.1 3.1 3.4 3.4 0 00.8 1.9 3.4 3.4 0 010 4.4 3.4 3.4 0 00-.8 1.9 3.4 3.4 0 01-3.1 3.1 3.4 3.4 0 00-1.9.8 3.4 3.4 0 01-4.4 0 3.4 3.4 0 00-1.9-.8 3.4 3.4 0 01-3.1-3.1 3.4 3.4 0 00-.8-1.9 3.4 3.4 0 010-4.4 3.4 3.4 0 00.8-1.9 3.4 3.4 0 013.1-3.1z", home: "M3 12l9-9 9 9v9h-6v-6H9v6H3z", shield: "M12 3l8 3v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6l8-3zm-3 9 2 2 4-4", leaf: "M20 4C11 4 5 8 5 15c0 3 2 5 5 5 7 0 10-7 10-16z", heart: "M12 21S3 15.5 3 9.5A4.5 4.5 0 0112 8a4.5 4.5 0 019 1.5C21 15.5 12 21 12 21z" };
  return <svg className="h-6 w-6 text-terracotta" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={paths[name] || paths.sparkles} /></svg>;
}

export default function TrustServiceStrip({ items }) {
  const visibleItems = (Array.isArray(items) && items.length ? items : FALLBACK_ITEMS).filter((item) => item.enabled !== false).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  return <section className="border-y border-charcoal/10 bg-[#FAF6F0]"><div className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-charcoal/10 px-4 sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:px-8 lg:grid-cols-4">{visibleItems.map((item) => <div key={item.id || item.title} className="flex gap-3 py-5 sm:px-5"><TrustIcon name={item.icon} /><div><h3 className="text-sm font-semibold text-charcoal">{item.title}</h3><p className="mt-1 text-xs leading-relaxed text-charcoal-soft">{item.description}</p></div></div>)}</div></section>;
}
