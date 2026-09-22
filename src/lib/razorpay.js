let loadPromise = null;

// Loads the Razorpay Checkout script once and caches the promise — safe to
// call from multiple components without injecting the <script> tag twice.
export function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve(true);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  return loadPromise;
}
