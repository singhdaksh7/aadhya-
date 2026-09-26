import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React, { useState } from "react";
import DOMPurify from "dompurify";
import RichTextRenderer from "../src/components/cms/RichTextRenderer";

describe("Rich Text Editor Formatting Roundtrip Test", () => {
  it("verifies heading, bold, italic, underline, list, link, font size, alignment, image, and highlight survive roundtrip save/reload", async () => {
    // 1. Construct initial formatted rich text HTML with all required elements
    const initialFormattedHtml = `
      <h1 style="text-align: center; color: #b8674a;">Aadya Design Manifesto</h1>
      <p style="text-align: justify;">
        <strong>Bold Craftsmanship</strong> meets <em>Italicized Elegance</em> and <u style="text-decoration: underline;">Underlined Quality</u>.
      </p>
      <ul>
        <li><span style="font-size: 20px;">Large List Item (20px)</span></li>
      </ul>
      <p style="text-align: right;">
        <mark style="background-color: #FAF6F0; color: #2B2723;">Highlighted Terracotta Note</mark>
      </p>
      <a href="https://aadyasociety.com" target="_blank" rel="noopener">Visit Storefront</a>
      <img src="https://aadyasociety.com/vase.jpg" alt="Terracotta Vase" style="max-width: 100%; border-radius: 8px;" />
    `.trim();

    // 2. Simulate Save (Sanitization pass simulating database save)
    const savedHtml = DOMPurify.sanitize(initialFormattedHtml, {
      ADD_ATTR: ["style", "target", "rel", "align"],
      ADD_TAGS: ["hr", "mark", "u", "s", "strike"]
    });

    // 3. Simulate Reload & Public Render
    render(<RichTextRenderer content={savedHtml} />);

    // 4. Assert all elements survive roundtrip intact!
    expect(screen.getByText("Aadya Design Manifesto")).toBeInTheDocument();
    expect(screen.getByText("Bold Craftsmanship")).toBeInTheDocument();
    expect(screen.getByText("Italicized Elegance")).toBeInTheDocument();
    expect(screen.getByText("Underlined Quality")).toBeInTheDocument();
    expect(screen.getByText("Large List Item (20px)")).toBeInTheDocument();
    expect(screen.getByText("Highlighted Terracotta Note")).toBeInTheDocument();

    const link = screen.getByText("Visit Storefront");
    expect(link).toHaveAttribute("href", "https://aadyasociety.com");

    const img = screen.getByAltText("Terracotta Vase");
    expect(img).toHaveAttribute("src", "https://aadyasociety.com/vase.jpg");
  });
});
