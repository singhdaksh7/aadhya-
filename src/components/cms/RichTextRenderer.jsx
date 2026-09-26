import React from "react";
import DOMPurify from "dompurify";

export default function RichTextRenderer({ content, className = "" }) {
  if (!content) return null;

  const sanitized = DOMPurify.sanitize(content, {
    ADD_ATTR: ["style", "target", "rel", "align"],
    ADD_TAGS: ["hr", "mark", "u", "s", "strike"]
  });

  return (
    <div
      className={`prose prose-stone max-w-none text-charcoal font-sans prose-headings:font-serif-display prose-headings:text-charcoal prose-a:text-terracotta hover:prose-a:underline prose-img:rounded-2xl prose-img:shadow-sm prose-blockquote:border-l-terracotta prose-blockquote:text-charcoal-soft ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
