import React from "react";
import { useGiftingHomepageSetting } from "../../hooks/useGiftingHomepageSetting";

const COPY = {
  builder: { heading: "Gifting Section", label: "Show on Homepage" },
  page: { heading: null, label: "Show Gifting section on Homepage" },
};

/** The one control for `showGiftingOnHomepage`, rendered in the Homepage Builder and in Gifting page settings. */
export default function GiftingHomepageSwitch({ variant = "builder" }) {
  const { value, saving, error, save } = useGiftingHomepageSetting();
  const { heading, label } = COPY[variant] || COPY.builder;
  return (
    <div data-testid={`gifting-homepage-switch-${variant}`} className={variant === "builder" ? "admin-card p-4" : "rounded-xl border border-charcoal/10 p-3"}>
      {heading && <h2 className="admin-card__title mb-2">{heading}</h2>}
      <label className="flex items-start justify-between gap-4 text-xs font-semibold text-charcoal">
        <span>
          {label}
          <span className="mt-0.5 block font-normal text-charcoal-soft">
            Shows or hides the gifting cards on the storefront home page. The /gifting page, header and footer links, popup and bulk inquiry are not affected.
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          aria-label={label}
          checked={value === true}
          disabled={value === null || saving}
          onChange={(e) => save(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0"
        />
      </label>
      {error && <p role="alert" className="mt-1 text-xs font-semibold text-terracotta">{error}</p>}
    </div>
  );
}
