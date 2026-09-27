// First-touch UTM attribution capture. Reads utm_* params off the landing
// URL once and persists them (localStorage survives across a session /
// closed tab; a session-scoped sessionStorage id is kept separately for
// analytics event correlation). The stored UTM values are snapshotted onto
// the order at checkout so completed orders always know what brought that
// customer in, even though the landing page might have been visited days
// before the purchase.
const UTM_KEY = "aadya_utm_attribution";
const SESSION_KEY = "aadya_session_id";

const UTM_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

export function captureUtmFromUrl(search = window.location.search) {
  try {
    const params = new URLSearchParams(search);
    const hasAny = UTM_PARAMS.some((p) => params.has(p));
    if (!hasAny) return;

    const attribution = {
      utmSource: params.get("utm_source") || null,
      utmMedium: params.get("utm_medium") || null,
      utmCampaign: params.get("utm_campaign") || null,
      utmContent: params.get("utm_content") || null,
      utmTerm: params.get("utm_term") || null,
      capturedAt: new Date().toISOString(),
    };
    // First-touch: never overwrite an existing attribution with a later one.
    if (!localStorage.getItem(UTM_KEY)) {
      localStorage.setItem(UTM_KEY, JSON.stringify(attribution));
    }
  } catch {
    // localStorage unavailable (private mode etc.) — attribution is
    // best-effort only, never block navigation on it.
  }
}

export function getStoredUtmAttribution() {
  try {
    const raw = localStorage.getItem(UTM_KEY);
    if (!raw) return {};
    const { utmSource, utmMedium, utmCampaign, utmContent, utmTerm } = JSON.parse(raw);
    return { utmSource, utmMedium, utmCampaign, utmContent, utmTerm };
  } catch {
    return {};
  }
}

export function getSessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}
