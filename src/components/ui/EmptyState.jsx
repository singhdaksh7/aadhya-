import React from "react";
import { Link } from "react-router-dom";
import { IconCart, IconLeaf } from "../icons";

export function EmptyState({
  title = "No products found",
  description = "Try adjusting your filters or search terms to discover our collection.",
  actionText = "Explore Shop",
  actionLink = "/shop",
  onAction = null,
  icon = null
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-charcoal/20 bg-ivory-dark/40 px-6 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-beige-light text-terracotta shadow-sm">
        {icon || <IconLeaf width="32" height="32" />}
      </div>
      <h3 className="font-serif-display text-xl text-charcoal sm:text-2xl">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-charcoal-soft leading-relaxed">{description}</p>
      {onAction ? (
        <button
          onClick={onAction}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-terracotta px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-ivory transition hover:bg-terracotta/90"
        >
          {actionText}
        </button>
      ) : actionLink ? (
        <Link
          to={actionLink}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-terracotta px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-ivory transition hover:bg-terracotta/90"
        >
          {actionText}
        </Link>
      ) : null}
    </div>
  );
}

export function EmptyCartState() {
  return (
    <EmptyState
      title="Your cart is empty"
      description="It seems you haven't added any handcrafted home decor or books yet. Explore our curated collections to find thoughtful pieces for your sanctuary."
      actionText="Browse Shop"
      actionLink="/shop"
      icon={<IconCart width="32" height="32" />}
    />
  );
}
