import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import ProductCatalog from "./ProductCatalog";
import BooksShowcase from "../../components/shop/BooksShowcase";
import BookCard from "../../components/shop/BookCard";
import { getProducts, getCategories } from "../../services/api";

export default function BooksStorefront() {
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const { hash } = useLocation();

  // Menu links such as /shop/books#new-releases: once the books have rendered, scroll to that module
  // (or to the showcase itself when the module has no books).
  useEffect(() => {
    if (!hash || books.length === 0) return;
    const id = decodeURIComponent(hash.slice(1));
    const el = document.getElementById(id) || document.querySelector('[data-testid="books-showcase"]');
    el?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [hash, books.length]);

  useEffect(() => {
    let active = true;
    Promise.all([getProducts({ category: "BOOK" }), getCategories()])
      .then(([booksRes, catsRes]) => {
        if (!active) return;
        setBooks(booksRes.data || []);
        setCategories(catsRes.data || []);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // Browse-by-theme chips: active subcategories of Books that actually contain books.
  const themes = useMemo(() => {
    const root = categories.find((c) => c.slug === "books");
    if (!root) return [];
    const subtree = (id) => [id, ...categories.filter((c) => c.parentId === id && c.isActive !== false).flatMap((c) => subtree(c.id))];
    return categories
      .filter((c) => c.parentId === root.id && c.isActive !== false)
      .filter((c) => books.some((b) => subtree(c.id).includes(b.categoryId)))
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [categories, books]);

  return (
    <>
      <title>Books &amp; Monographs — Aadya Storefront</title>
      <meta
        name="description"
        content="Browse editorial coffee-table books, art heritage monographs, and mindfulness guides from Aadya Editorial Press."
      />
      <ProductCatalog
        eyebrow="Editorial Monographs"
        title="From Our Bookshelf"
        description="Titles on slow craftsmanship, mindful architecture, Indian handloom heritage, and daily tea rituals."
        lockedCategory="books"
        beforeCatalog={<BooksShowcase books={books} themes={themes} />}
        CardComponent={BookCard}
        gridClassName="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-3"
      />
    </>
  );
}
