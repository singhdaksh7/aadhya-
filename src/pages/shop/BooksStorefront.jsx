import React from "react";
import ProductCatalog from "./ProductCatalog";

export default function BooksStorefront() {
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
      />
    </>
  );
}
