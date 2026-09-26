import sanitizeHtml from "sanitize-html";

export function sanitizeRichText(dirtyHtml) {
  if (!dirtyHtml || typeof dirtyHtml !== "string") {
    return "";
  }

  return sanitizeHtml(dirtyHtml, {
    allowedTags: [
      "h1", "h2", "h3", "h4", "h5", "h6",
      "p", "span", "div", "blockquote", "pre", "code",
      "strong", "b", "em", "i", "u", "s", "strike", "del", "sub", "sup", "mark",
      "ul", "ol", "li",
      "a", "img", "hr", "br",
      "table", "thead", "tbody", "tfoot", "tr", "th", "td"
    ],
    allowedAttributes: {
      a: ["href", "target", "rel", "title", "class", "style"],
      img: ["src", "alt", "title", "width", "height", "class", "style", "loading"],
      "*": ["style", "class", "id", "align"]
    },
    allowedStyles: {
      "*": {
        "color": [/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, /^rgb\(/i, /^rgba\(/i, /^[a-z]+$/i],
        "background-color": [/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, /^rgb\(/i, /^rgba\(/i, /^[a-z]+$/i],
        "font-size": [/^\d+(px|em|rem|pt|%)$/],
        "font-family": [/.*/],
        "text-align": [/^(left|center|right|justify)$/],
        "margin": [/.*/],
        "margin-left": [/.*/],
        "margin-right": [/.*/],
        "margin-top": [/.*/],
        "margin-bottom": [/.*/],
        "padding": [/.*/],
        "float": [/^(left|right|none)$/],
        "display": [/.*/]
      }
    },
    allowedSchemes: ["http", "https", "mailto", "tel", "data"],
    allowProtocolRelative: true,
    enforceHtmlBoundary: false
  });
}
