// Small SEO helpers used across pages. The project's head-management
// pattern is React 19's native support for hoisting <title>/<meta>/<link>
// tags rendered anywhere in the tree — no react-helmet dependency needed.
// JSON-LD structured data is injected via plain <script type="application/ld+json">
// tags rendered in the page body (valid per schema.org regardless of head placement).

export function canonicalUrl(pathname) {
  if (typeof window === "undefined") return pathname;
  return `${window.location.origin}${pathname}`;
}

export function jsonLdProps(data) {
  return { dangerouslySetInnerHTML: { __html: JSON.stringify(data) } };
}
