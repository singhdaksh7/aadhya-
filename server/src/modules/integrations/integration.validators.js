// Field-level validation for admin-submitted integration credentials.
// Kept separate from the generic envelope schema in integration.routes.js
// so each provider can return errors shaped for the admin UI to render
// next to the relevant input, instead of a single "Validation failed".

const TEST_PREFIX = "rzp_test_";
const LIVE_PREFIX = "rzp_live_";

function str(value) {
  return typeof value === "string" ? value.trim() : "";
}

// Returns { errors } when invalid, or { data } with trimmed fields when valid.
export function validateRazorpayCredential(environment, rawData) {
  const errors = {};
  const data = rawData && typeof rawData === "object" ? rawData : {};

  const keyId = str(data.keyId);
  const keySecret = str(data.keySecret);
  const webhookSecret = str(data.webhookSecret);

  if (environment !== "TEST" && environment !== "LIVE") {
    errors.environment = "Environment must be TEST or LIVE for Razorpay.";
  }

  if (!keyId) {
    errors.keyId = "Razorpay Key ID is required.";
  } else if (environment === "TEST" && keyId.startsWith(LIVE_PREFIX)) {
    errors.keyId = "This looks like a LIVE Razorpay key. Select LIVE or use a TEST key.";
  } else if (environment === "LIVE" && keyId.startsWith(TEST_PREFIX)) {
    errors.keyId = "This looks like a TEST Razorpay key. Select TEST or use a LIVE key.";
  }

  if (!keySecret) {
    errors.keySecret = "Razorpay Key Secret is required.";
  }

  if (!webhookSecret) {
    errors.webhookSecret = "Webhook secret is required for Razorpay webhook verification.";
  }

  if (Object.keys(errors).length > 0) return { errors };
  return { data: { keyId, keySecret, webhookSecret } };
}
