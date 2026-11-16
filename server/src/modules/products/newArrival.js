// Hybrid "New Arrival" rule, shared by every customer-facing surface.
//
// A product is an effective New Arrival when EITHER
//   A. it is inside its automatic window: created within the last NEW_ARRIVAL_WINDOW_DAYS days, OR
//   B. an admin manually set the existing `isNewArrival` flag (the manual override).
//
// The automatic window is anchored to `createdAt` (never `updatedAt`), so editing a product's
// price, stock, images, SEO, etc. can never make an old product "new" again. Time is evaluated on
// the server; the age is a plain millisecond difference, so it is timezone independent.
export const NEW_ARRIVAL_WINDOW_DAYS = 7;
export const NEW_ARRIVAL_WINDOW_MS = NEW_ARRIVAL_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export function newArrivalCutoff(now = new Date()) {
  return new Date(new Date(now).getTime() - NEW_ARRIVAL_WINDOW_MS);
}

// Inside the automatic window (inclusive of the exact 7-day boundary).
export function isWithinAutoNewArrivalWindow(product, now = new Date()) {
  if (!product?.createdAt) return false;
  const created = new Date(product.createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return created >= newArrivalCutoff(now).getTime();
}

export function isEffectiveNewArrival(product, now = new Date()) {
  if (!product) return false;
  return product.isNewArrival === true || isWithinAutoNewArrivalWindow(product, now);
}

// Prisma `where` fragment equivalent to isEffectiveNewArrival (wanted = true) or its negation.
export function newArrivalWhere(wanted = true, now = new Date()) {
  const cutoff = newArrivalCutoff(now);
  return wanted
    ? { OR: [{ isNewArrival: true }, { createdAt: { gte: cutoff } }] }
    : { isNewArrival: false, createdAt: { lt: cutoff } };
}
