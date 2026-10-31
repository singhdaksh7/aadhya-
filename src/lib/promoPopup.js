/**
 * Pure helpers for the promotional popup: where it may appear, and how often.
 * Everything touching browser storage is wrapped in try/catch so private windows,
 * blocked site data and SSR never break the page (the popup then simply behaves as session-only).
 */

export const POPUP_STORAGE_PREFIX = "promoPopup:";
const DAY_MS = 24 * 60 * 60 * 1000;

// Never interrupt these flows, whatever the targeting says.
const BLOCKED_PREFIXES = ["/admin", "/checkout", "/payment", "/order", "/cart"];

export function normalizePath(pathname = "/") {
  const path = String(pathname || "/").split("?")[0].split("#")[0];
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/";
}

export function isBlockedPath(pathname) {
  const path = normalizePath(pathname);
  return BLOCKED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** True when `pathname` matches a route rule: exact, or `/prefix/*` for a whole section. */
export function routeMatches(rule, pathname) {
  const target = normalizePath(pathname);
  const r = String(rule || "").trim();
  if (!r) return false;
  if (r.endsWith("/*")) {
    const base = normalizePath(r.slice(0, -2));
    return target === base || target.startsWith(`${base}/`);
  }
  return normalizePath(r) === target;
}

export function matchesTargeting(popup, pathname) {
  if (!popup || isBlockedPath(pathname)) return false;
  const path = normalizePath(pathname);
  switch (popup.targeting) {
    case "ALL":
      return true;
    case "SELECTED":
      return Array.isArray(popup.routes) && popup.routes.some((rule) => routeMatches(rule, path));
    case "HOME":
    default:
      return path === "/";
  }
}

function storageFor(kind) {
  try {
    if (typeof window === "undefined") return null;
    return kind === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

/** Per-campaign key: editing the popup in admin changes `version`, so a new campaign shows again. */
export function popupStorageKey(popup) {
  return `${POPUP_STORAGE_PREFIX}${popup?.version ?? 0}`;
}

function readRecord(popup, kind) {
  try {
    const raw = storageFor(kind)?.getItem(popupStorageKey(popup));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

// In-memory fallback so a blocked/failed storage still prevents re-showing within one page session.
const memory = new Map();

export function recordPopupSeen(popup, now = Date.now(), { dismissed = false } = {}) {
  const key = popupStorageKey(popup);
  const kind = popup?.frequency === "SESSION" || !popup?.frequency ? "session" : "local";
  const prev = readRecord(popup, kind) || memory.get(key) || {};
  const record = { ...prev, lastShownAt: dismissed ? (prev.lastShownAt ?? now) : now,...(dismissed ? { dismissedAt: now } : {}) };
  memory.set(key, record);
  try {
    storageFor(kind)?.setItem(key, JSON.stringify(record));
  } catch {
    /* storage unavailable: the in-memory record still applies */
  }
  return record;
}

export function popupFrequencyAllows(popup, now = Date.now()) {
  if (!popup) return false;
  const kind = popup.frequency === "SESSION" || !popup.frequency ? "session" : "local";
  const record = readRecord(popup, kind) || memory.get(popupStorageKey(popup));
  if (!record) return true;
  if (kind === "session") return false;
  const last = Math.max(Number(record.lastShownAt) || 0, Number(record.dismissedAt) || 0);
  if (!last) return true;
  const intervalDays = popup.frequency === "EVERY_X_DAYS" ? Math.max(1, Number(popup.days) || 1) : 1;
  return now - last >= intervalDays * DAY_MS;
}

export function shouldShowPopup(popup, pathname, now = Date.now()) {
  if (!popup || popup.enabled === false) return false;
  if (!popup.title) return false;
  return matchesTargeting(popup, pathname) && popupFrequencyAllows(popup, now);
}

/** Only relative paths and http(s) URLs may be linked from the popup. */
export function safePopupHref(url) {
  const v = typeof url === "string" ? url.trim() : "";
  if (!v) return "";
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  return /^https?:\/\//i.test(v) ? v : "";
}

/** Test hook: forget the in-memory fallback. */
export function resetPopupMemory() {
  memory.clear();
}
