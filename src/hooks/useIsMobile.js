import { useEffect, useState } from "react";

// The storefront's phone breakpoint: below Tailwind's `md` (768px). The PDP sticky bar, footer and category
// nav already treat >=768px as "desktop/tablet", so a tablet keeps desktop behaviour.
export const MOBILE_QUERY = "(max-width: 767.98px)";

const read = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(MOBILE_QUERY).matches : false);

export function useIsMobile() {
  const [mobile, setMobile] = useState(read);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setMobile(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return mobile;
}

// Link attributes for product navigation: phones open the product in a new tab, tablet/desktop stay in-tab.
export function useProductLinkProps() {
  return useIsMobile() ? { target: "_blank", rel: "noopener noreferrer" } : {};
}
