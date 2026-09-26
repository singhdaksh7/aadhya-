import React from "react";

const TRUST_ITEMS = [
  {
    icon: (
      <svg className="h-6 w-6 text-terracotta" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
    title: "Thoughtfully Curated",
    desc: "Hand-selected slow design objects for mindful living"
  },
  {
    icon: (
      <svg className="h-6 w-6 text-terracotta" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
    title: "Premium Quality",
    desc: "Authentic materials from Indian craft clusters"
  },
  {
    icon: (
      <svg className="h-6 w-6 text-terracotta" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    title: "Styles for Every Space",
    desc: "Proportions tailored for modern and traditional homes"
  },
  {
    icon: (
      <svg className="h-6 w-6 text-terracotta" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: "Secure Payments",
    desc: "100% encrypted checkout & Pan-India express dispatch"
  }
];

export default function TrustServiceStrip() {
  return (
    <section className="bg-white border-y border-charcoal/10 py-8 px-4 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-0 divide-y lg:divide-y-0 lg:divide-x divide-charcoal/10">
          {TRUST_ITEMS.map((item, idx) => (
            <div
              key={idx}
              className="flex items-start gap-4 px-2 lg:px-6 pt-4 lg:pt-0 first:pt-0"
            >
              <div className="p-2 rounded-xl bg-[#FAF6F0] shrink-0">
                {item.icon}
              </div>
              <div className="space-y-1">
                <h4 className="font-serif-display text-sm sm:text-base text-charcoal font-semibold">
                  {item.title}
                </h4>
                <p className="text-xs text-charcoal-soft leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
