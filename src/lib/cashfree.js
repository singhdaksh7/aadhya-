let loadPromise = null;

// Loads Cashfree's JS SDK (v3) once and caches the promise; safe to call from several places.
export function loadCashfreeScript() {
  if (window.Cashfree) return Promise.resolve(true);
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.onload = () => resolve(true);
    script.onerror = () => {
      loadPromise = null; // allow a retry after a network failure
      resolve(false);
    };
    document.body.appendChild(script);
  });
  return loadPromise;
}
