import { Link } from "react-router-dom";
import { getContrastColor } from "../../lib/color";

// Theme-aware Button for the storefront, distinct from the legacy
// hardcoded-palette Button in src/components/ui.jsx (which is also used
// inside the admin dashboard and must NOT pick up storefront theme colors).
// Use THIS component anywhere a button's color should follow the
// Admin -> Settings -> Appearance theme (see src/hooks/useSiteSettings.js
// applyThemeVariables / src/index.css .store-* utilities).
//
// Variants:
//   primary  - theme-primary background, contrast-computed text
//   secondary- theme-secondary background, contrast-computed text
//   outline  - theme-primary border + text, transparent background
//   ghost    - no border/background, theme-primary text
//   danger   - semantic red (never themed — status colors stay fixed)
//
// Usage:
//   <Button variant="primary">Add to Cart</Button>
//   <Button variant="outline" as="link" to="/shop">Shop Now</Button>

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium tracking-wide transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

function getPrimaryTextColor() {
  if (typeof document === "undefined") return "#FFFFFF";
  const root = document.documentElement;
  const primary = getComputedStyle(root).getPropertyValue("--theme-primary")?.trim() || "#B8674A";
  return getContrastColor(primary);
}

function getSecondaryTextColor() {
  if (typeof document === "undefined") return "#FFFFFF";
  const root = document.documentElement;
  const secondary = getComputedStyle(root).getPropertyValue("--theme-secondary")?.trim() || "#8A9A82";
  return getContrastColor(secondary);
}

export default function Button({ as = "button", to, href, variant = "primary", className = "", style = {}, children, ...rest }) {
  let variantClass = "";
  let variantStyle = {};

  switch (variant) {
    case "secondary": {
      const textColor = getSecondaryTextColor();
      variantClass = "focus-visible:ring-[var(--theme-secondary)]";
      variantStyle = { backgroundColor: "var(--theme-secondary)", color: textColor };
      break;
    }
    case "outline":
      variantClass = "border bg-transparent focus-visible:ring-[var(--theme-primary)]";
      variantStyle = { borderColor: "var(--theme-primary)", color: "var(--theme-primary)" };
      break;
    case "ghost":
      variantClass = "bg-transparent hover:underline underline-offset-4";
      variantStyle = { color: "var(--theme-primary)" };
      break;
    case "danger":
      // Status colors are semantic, not themed — stays fixed red regardless of Appearance settings.
      variantClass = "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600";
      break;
    case "primary":
    default: {
      const textColor = getPrimaryTextColor();
      variantClass = "hover:brightness-95 focus-visible:ring-[var(--theme-primary)]";
      variantStyle = { backgroundColor: "var(--theme-primary)", color: textColor };
      break;
    }
  }

  const cls = `${BASE} ${variantClass} ${className}`;
  const finalStyle = { ...variantStyle, ...style };

  if (to) {
    return (
      <Link to={to} className={cls} style={finalStyle} {...rest}>
        {children}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={cls} style={finalStyle} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <button className={cls} style={finalStyle} {...rest}>
      {children}
    </button>
  );
}
