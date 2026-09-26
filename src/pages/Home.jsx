import React, { useEffect, useState } from "react";
import HomepageRenderer from "../components/HomepageRenderer";
import { fetchHomepage } from "../lib/api";

export default function Home() {
  const [sections, setSections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    async function loadHomepage() {
      setIsLoading(true);
      try {
        const res = await fetchHomepage();
        if (!active) return;
        const pageSections = res.sections || res.data?.sections || [];
        setSections(pageSections);
        setError(null);
      } catch (err) {
        if (!active) return;
        console.error("Failed to load homepage sections:", err);
        setError("Unable to load homepage content. Please try refreshing the page.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadHomepage();
    return () => {
      active = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white min-h-[60vh] flex items-center justify-center">
        <div className="text-center py-16">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-terracotta border-r-transparent align-[-0.125em]" />
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Loading Aadya...</p>
        </div>
      </div>
    );
  }

  if (error && sections.length === 0) {
    return (
      <div className="bg-white min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md py-16 rounded-2xl bg-[#FAF6F0] p-8 border border-charcoal/10">
          <h2 className="font-serif-display text-2xl font-bold text-charcoal">Storefront Unavailable</h2>
          <p className="mt-2 text-xs text-charcoal-soft leading-relaxed">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 rounded-full bg-terracotta px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-white hover:bg-terracotta-dark transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return <HomepageRenderer sections={sections} />;
}
