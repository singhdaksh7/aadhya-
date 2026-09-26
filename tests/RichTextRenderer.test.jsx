import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import React from "react";
import RichTextRenderer from "../src/components/cms/RichTextRenderer";

describe("RichTextRenderer", () => {
  it("renders sanitized HTML safely with headings, formatting, and images", () => {
    const rawContent = `
      <h2 style="color: #b8674a;">Handcrafted Ceramics</h2>
      <p>Slowly crafted with <strong>natural minerals</strong> and <em>artisan love</em>.</p>
      <ul><li>Terracotta Clay</li><li>Sage Mineral Glaze</li></ul>
      <a href="https://aadyasociety.com" target="_blank">Visit Aadya</a>
      <img src="https://aadyasociety.com/banner.jpg" alt="Aadya Banner" />
      <script>alert('xss')</script>
    `;

    render(<RichTextRenderer content={rawContent} />);

    expect(screen.getByText("Handcrafted Ceramics")).toBeInTheDocument();
    expect(screen.getByText("natural minerals")).toBeInTheDocument();
    expect(screen.getByText("artisan love")).toBeInTheDocument();
    expect(screen.getByText("Terracotta Clay")).toBeInTheDocument();
    expect(screen.getByText("Visit Aadya")).toBeInTheDocument();
    expect(screen.getByAltText("Aadya Banner")).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
  });
});
