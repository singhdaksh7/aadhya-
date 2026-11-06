import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BookCard from "../src/components/shop/BookCard";
import BooksShowcase from "../src/components/shop/BooksShowcase";

const book = { id: "b1", slug: "the-book", name: "The Book", price: 300, images: ["/b.jpg"], bookDetail: { author: "A. Writer" } };
function viewport(width) {
  window.matchMedia = vi.fn((q) => {
    const max = /max-width:\s*([\d.]+)px/.exec(q);
    return { matches: max ? width <= Number(max[1]) : false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  });
}
afterEach(() => { delete window.matchMedia; });
const bookLinks = () => screen.getAllByRole("link").filter((a) => a.getAttribute("href") === "/shop/the-book");

describe("book product links", () => {
  it("390px: BookCard opens in a new tab", () => {
    viewport(390);
    render(<MemoryRouter><BookCard product={book} /></MemoryRouter>);
    const a = screen.getByTestId("book-card");
    expect(a).toHaveAttribute("target", "_blank");
    expect(a).toHaveAttribute("rel", "noopener noreferrer");
  });
  it("390px: featured book links in the showcase open in a new tab", () => {
    viewport(390);
    render(<MemoryRouter><BooksShowcase books={[book]} /></MemoryRouter>);
    const links = bookLinks();
    expect(links.length).toBeGreaterThan(1);
    links.forEach((a) => expect(a).toHaveAttribute("target", "_blank"));
  });
  it.each([768, 1280])("%ipx: same tab", (w) => {
    viewport(w);
    render(<MemoryRouter><BookCard product={book} /><BooksShowcase books={[book]} /></MemoryRouter>);
    bookLinks().forEach((a) => expect(a).not.toHaveAttribute("target"));
  });
});
