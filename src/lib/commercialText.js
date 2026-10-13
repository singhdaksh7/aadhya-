import { formatInr } from "./format";

// Single source for customer-facing commercial facts (shipping threshold, return window, dispatch
// time, ...). Copy that mentions these should come from here / from admin placeholders, never from
// literals typed in React source, so one Store Settings change keeps every message consistent.

const MONEY_KEYS = new Set(["freeShippingThreshold", "standardShippingAmount"]);
const present = (v) => v !== undefined && v !== null && v !== "";
const KNOWN_KEYS = new Set(["freeShippingThreshold", "standardShippingAmount", "returnWindowDays", "dispatchEstimate", "deliveryEstimate", "storeName", "supportEmail", "supportPhone"]);

export function commercialContext(settings = {}) {
  const shipping = settings.shipping || {};
  const returns = settings.returns || {};
  const general = settings.general || {};
  return {
    freeShippingThreshold: shipping.freeShippingThreshold ?? settings.freeShippingThreshold,
    standardShippingAmount: shipping.standardShippingAmount ?? settings.standardShippingAmount,
    dispatchEstimate: shipping.dispatchEstimate,
    deliveryEstimate: shipping.deliveryEstimate,
    returnsEnabled: returns.enabled !== false,
    returnWindowDays: returns.windowDays,
    pricesIncludeTax: settings.checkout?.pricesIncludeTax !== false,
    storeName: general.storeName,
    supportEmail: settings.supportEmail || general.supportEmail,
    supportPhone: settings.supportPhone || general.supportPhone,
  };
}

function render(key, value) {
  if (!present(value)) return "";
  return MONEY_KEYS.has(key) ? formatInr(value) : String(value);
}

// Replaces {{key}} and {key} placeholders (e.g. "Free shipping on orders {freeShippingThreshold}+").
// A placeholder with no configured value renders as empty text rather than leaking the raw token.
export function interpolateCommercial(template, ctx = {}) {
  if (!template || typeof template !== "string") return "";
  return template
    .replace(/\{\{\s*([a-zA-Z]+)\s*\}\}|\{\s*([a-zA-Z]+)\s*\}/g, (match, a, b) => {
      const key = a || b;
      return KNOWN_KEYS.has(key) ? render(key, ctx[key]) : match;
    })
    .replace(/[ \t]{2,}/g, " ");
}

export const returnWindowLabel = (ctx) => (ctx.returnsEnabled && Number(ctx.returnWindowDays) > 0 ? `${Number(ctx.returnWindowDays)}-day returns` : "");

// Short reassurance line under the cart totals; only states what the store settings support.
export function cartPolicyNote(ctx) {
  const text = [ctx.pricesIncludeTax ? "Taxes included" : "", returnWindowLabel(ctx)].filter(Boolean).join(". ");
  return text ? `${text}.` : "";
}

// Fallback for the product page "Shipping" tab when a product has no shipping text of its own.
export function shippingInfoText(ctx) {
  const parts = [];
  if (present(ctx.dispatchEstimate)) parts.push(`Dispatched within ${ctx.dispatchEstimate}.`);
  if (present(ctx.deliveryEstimate)) parts.push(`Estimated delivery in ${ctx.deliveryEstimate}.`);
  if (Number(ctx.freeShippingThreshold) > 0) parts.push(`Free shipping on orders above ${formatInr(ctx.freeShippingThreshold)}.`);
  else if (present(ctx.standardShippingAmount) && Number(ctx.standardShippingAmount) === 0) parts.push("Free shipping on all orders.");
  return parts.join(" ");
}
