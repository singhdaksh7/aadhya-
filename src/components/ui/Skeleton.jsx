import React from "react";

export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-lg bg-charcoal/10 ${className}`} />;
}

export function ProductCardSkeleton() {
  return (
    <div className="group rounded-2xl border border-charcoal/10 bg-white p-3 space-y-3">
      <Skeleton className="aspect-square w-full rounded-xl" />
      <div className="space-y-2 px-1">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex justify-between items-center pt-2">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function PDPSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-4">
        <Skeleton className="aspect-square w-full rounded-2xl" />
        <div className="flex gap-3">
          <Skeleton className="h-20 w-20 rounded-xl" />
          <Skeleton className="h-20 w-20 rounded-xl" />
          <Skeleton className="h-20 w-20 rounded-xl" />
        </div>
      </div>
      <div className="space-y-5 pt-4">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="flex gap-4 pt-4">
          <Skeleton className="h-12 w-32 rounded-full" />
          <Skeleton className="h-12 flex-1 rounded-full" />
        </div>
      </div>
    </div>
  );
}
