// Single home for the wording of every transactional email. Nothing here executes: templates are plain
// text with whitelisted {{placeholders}}; unknown placeholders render as empty, values are HTML-escaped
// before they reach the layout, and the layout/order summary live in layout.js (code, not editable).
//
// Brand rule: customer-facing wording says "Tushaqsa" (via {{brandName}}) and signs off "Team Tushaqsa".

export const TEMPLATE_VARIABLES = {
  customerName: "Customer's full name",
  firstName: "Customer's first name",
  orderNumber: "Order number",
  orderDate: "Date the order was placed",
  orderTotal: "Final order total",
  paymentMethod: "Payment method",
  trackingNumber: "AWB / tracking number",
  courierName: "Courier name",
  trackingUrl: "Tracking link",
  accountUrl: "Link to the customer's account",
  orderUrl: "Link to view this order",
  supportEmail: "Store support email",
  brandName: "Store name (Tushaqsa)",
  cancellationReason: "Reason entered by Admin when cancelling",
  loginCode: "One-time login code (Login Code email only)",
  expiresInMinutes: "Minutes until the login code expires",
  resetUrl: "Password reset link",
  refundAmount: "Refund amount",
  // Admin notification emails only
  eventLabel: "What happened (e.g. New order received)",
  customerEmail: "Customer's email address (Admin emails only)",
  customerPhone: "Customer's phone number (Admin emails only)",
  paymentStatus: "Payment status",
  orderStatus: "Order status",
  shippingLocation: "Delivery city and state",
  adminOrderUrl: "Link to open the order in Admin (Admin emails only)",
  returnReason: "Reason given for a return request (Admin emails only)",
};
export const ALLOWED_VARIABLES = new Set(Object.keys(TEMPLATE_VARIABLES));

// blocks: which structured sections the layout adds after the message text.
//   summary  = full order summary (items, totals, payment, address)
//   tracking = courier / AWB / tracking link box (shown only when something is known)
//   code     = the one-time code box (always shown, independent of the editable text)
// cta: button { label, url: <variable name> }.
export const EMAIL_TEMPLATES = {
  ACCOUNT_CREATED: {
    label: "Welcome / Account created",
    audience: "account",
    defaultEnabled: true,
    subject: "Welcome to {{brandName}}",
    heading: "Welcome, {{firstName}}",
    body: "Your {{brandName}} account has been created.\n\nYou can sign in to see your orders, track deliveries and save your addresses. If you need anything, we are happy to help at {{supportEmail}}.",
    guestBody: "We created a {{brandName}} account for you using the email address you used at checkout, so you can follow your order.\n\nTo sign in, choose \"Email me a login code\" on the sign-in page and enter the code we send you. Once you are in, you can set a password. We never email passwords.\n\nQuestions? Write to us at {{supportEmail}}.",
    blocks: [],
    cta: { label: "Go to my account", url: "accountUrl" },
  },
  LOGIN_CODE: {
    label: "Login code",
    audience: "account",
    defaultEnabled: true,
    locked: true, // security email: cannot be switched off
    subject: "Your {{brandName}} login code",
    heading: "Your login code",
    body: "Use this code to sign in to {{brandName}}. It expires in {{expiresInMinutes}} minutes and can be used once.\n\nNever share this code with anyone. {{brandName}} will never ask you for it. If you did not ask for it, you can ignore this email.",
    blocks: ["code"],
    cta: null,
  },
  PASSWORD_RESET: {
    label: "Password reset",
    audience: "account",
    defaultEnabled: true,
    locked: true,
    subject: "Reset your {{brandName}} password",
    heading: "Reset your password",
    body: "We received a request to reset the password for your {{brandName}} account. The link below is valid for one hour.\n\nIf you did not request this, you can safely ignore this email and your password will stay the same.",
    blocks: [],
    cta: { label: "Reset password", url: "resetUrl" },
  },
  ORDER_PLACED: {
    label: "Order confirmation",
    audience: "order",
    defaultEnabled: true,
    subject: "Order confirmed — {{orderNumber}}",
    heading: "Thank you, {{firstName}}",
    body: "Your order {{orderNumber}} is confirmed. Here is a summary of what you ordered.",
    blocks: ["summary", "accountNote"],
    cta: { label: "View my order", url: "orderUrl" },
  },
  ORDER_PROCESSING: {
    label: "Order processing",
    audience: "order",
    defaultEnabled: false,
    subject: "We are preparing your {{brandName}} order",
    heading: "Your order is being prepared",
    body: "Good news, {{firstName}}: we have started preparing order {{orderNumber}}. We will email you again as soon as it ships.",
    blocks: [],
    cta: { label: "View my order", url: "orderUrl" },
  },
  ORDER_SHIPPED: {
    label: "Order shipped",
    audience: "order",
    defaultEnabled: true,
    subject: "Your Tushaqsa order has shipped",
    heading: "Your order is on its way",
    body: "Hello {{firstName}}, your order {{orderNumber}} has shipped.",
    blocks: ["tracking"],
    cta: { label: "Track my order", url: "trackingUrl" },
  },
  ORDER_IN_TRANSIT: {
    label: "Order in transit",
    audience: "order",
    defaultEnabled: false,
    subject: "Your Tushaqsa order is in transit",
    heading: "Your order is in transit",
    body: "Hello {{firstName}}, your order {{orderNumber}} is moving through the courier network.",
    blocks: ["tracking"],
    cta: { label: "Track my order", url: "trackingUrl" },
  },
  ORDER_OUT_FOR_DELIVERY: {
    label: "Out for delivery",
    audience: "order",
    defaultEnabled: true,
    subject: "Your Tushaqsa order is out for delivery",
    heading: "Out for delivery today",
    body: "Hello {{firstName}}, your order {{orderNumber}} is out for delivery. Please keep your phone nearby in case the courier needs to reach you.",
    blocks: ["tracking"],
    cta: { label: "Track my order", url: "trackingUrl" },
  },
  ORDER_DELIVERED: {
    label: "Delivered",
    audience: "order",
    defaultEnabled: true,
    subject: "Your Tushaqsa order has been delivered",
    heading: "Your order has been delivered",
    body: "Hello {{firstName}}, your order {{orderNumber}} has been delivered. We hope you love it.\n\nIf anything is not right, write to us at {{supportEmail}} and we will help.",
    blocks: [],
    cta: { label: "View my order", url: "orderUrl" },
  },
  ORDER_UNDELIVERED: {
    label: "Delivery attempt failed",
    audience: "order",
    defaultEnabled: true,
    subject: "Delivery attempt for your Tushaqsa order",
    heading: "We could not deliver your order",
    body: "Hello {{firstName}}, the courier could not complete the delivery of order {{orderNumber}}. They will usually try again. If you would like to arrange a time or correct the address, please contact us at {{supportEmail}}.",
    blocks: ["tracking"],
    cta: { label: "Track my order", url: "trackingUrl" },
  },
  ORDER_CANCELLED: {
    label: "Order cancelled",
    audience: "order",
    defaultEnabled: true,
    subject: "Update on your Tushaqsa order",
    heading: "Your order has been cancelled",
    body: "Hello {{firstName}}, order {{orderNumber}} has been cancelled.\n\nIf you have already paid, we will contact you about your refund. Questions? Write to us at {{supportEmail}}.",
    blocks: ["cancellationReason"],
    cta: { label: "View my order", url: "orderUrl" },
  },
  REFUND_INITIATED: {
    label: "Refund initiated",
    audience: "order",
    defaultEnabled: true,
    subject: "Your Tushaqsa refund has been initiated",
    heading: "Your refund is on its way",
    body: "Hello {{firstName}}, we have started a refund of {{refundAmount}} for order {{orderNumber}}. It can take a few business days to reach your original payment method.",
    blocks: [],
    cta: { label: "View my order", url: "orderUrl" },
  },
  REFUND_COMPLETED: {
    label: "Refund completed",
    audience: "order",
    defaultEnabled: true,
    subject: "Your Tushaqsa refund is complete",
    heading: "Your refund is complete",
    body: "Hello {{firstName}}, your refund of {{refundAmount}} for order {{orderNumber}} has been completed. Your bank may take a few days to show it.",
    blocks: [],
    cta: { label: "View my order", url: "orderUrl" },
  },

  // ---- Admin notification emails: sent to the internal recipients configured in Admin, never to customers.
  // Which events send an email is controlled per event (ADMIN_EVENTS below), not by the template toggle.
  ADMIN_NEW_ORDER: {
    label: "Admin: New order received",
    audience: "admin",
    locked: true,
    defaultEnabled: true,
    subject: "New order received — {{orderNumber}}",
    heading: "New order {{orderNumber}}",
    body: "A new order was placed on {{brandName}} on {{orderDate}}. Total {{orderTotal}}, payment: {{paymentMethod}} ({{paymentStatus}}).",
    blocks: ["adminOrder"],
    cta: { label: "Open order in Admin", url: "adminOrderUrl" },
  },
  ADMIN_PAYMENT_STATUS: {
    label: "Admin: Payment update",
    audience: "admin",
    locked: true,
    defaultEnabled: true,
    subject: "{{eventLabel}} — {{orderNumber}}",
    heading: "{{eventLabel}}",
    body: "Payment update for order {{orderNumber}} ({{orderTotal}}, {{customerName}}). Payment status is now {{paymentStatus}}.",
    blocks: ["adminOrder"],
    cta: { label: "Open order in Admin", url: "adminOrderUrl" },
  },
  ADMIN_SHIPMENT_STATUS: {
    label: "Admin: Shipment update",
    audience: "admin",
    locked: true,
    defaultEnabled: true,
    subject: "{{eventLabel}} — {{orderNumber}}",
    heading: "{{eventLabel}}",
    body: "Order {{orderNumber}} for {{customerName}} is now {{orderStatus}}.",
    blocks: ["adminOrder", "tracking"],
    cta: { label: "Open order in Admin", url: "adminOrderUrl" },
  },
  ADMIN_ORDER_UPDATE: {
    label: "Admin: Cancellation, return and refund update",
    audience: "admin",
    locked: true,
    defaultEnabled: true,
    subject: "{{eventLabel}} — {{orderNumber}}",
    heading: "{{eventLabel}}",
    body: "Update for order {{orderNumber}} ({{customerName}}): {{eventLabel}}.",
    blocks: ["adminOrder", "cancellationReason", "returnReason"],
    cta: { label: "Open order in Admin", url: "adminOrderUrl" },
  },
};

// Events an Admin can choose to be emailed about. `template` is the ADMIN_* template used, `defaultOn` the
// recommended default (the noisy shipment milestones and refunds are off until the owner opts in).
export const ADMIN_EVENTS = {
  NEW_ORDER: { label: "New order", help: "Every new order. Online orders are announced once payment is confirmed, so this email already shows payment as Paid.", template: "ADMIN_NEW_ORDER", defaultOn: true },
  PAYMENT_SUCCESS: { label: "Online payment successful", help: "Sent only when New order is switched off, because the New order email already covers a successful online payment.", template: "ADMIN_PAYMENT_STATUS", defaultOn: true },
  PAYMENT_FAILED: { label: "Payment failed", help: "An online payment attempt failed.", template: "ADMIN_PAYMENT_STATUS", defaultOn: true },
  ORDER_CANCELLED: { label: "Order cancelled", help: "An order was cancelled by Admin or the customer.", template: "ADMIN_ORDER_UPDATE", defaultOn: true },
  ORDER_SHIPPED: { label: "Order shipped", help: "Once per order, whether Admin or the courier marked it shipped.", template: "ADMIN_SHIPMENT_STATUS", defaultOn: false },
  OUT_FOR_DELIVERY: { label: "Out for delivery", help: "The courier is out for delivery.", template: "ADMIN_SHIPMENT_STATUS", defaultOn: false },
  DELIVERED: { label: "Delivered", help: "The order was delivered.", template: "ADMIN_SHIPMENT_STATUS", defaultOn: false },
  RETURN_REQUESTED: { label: "Return requested", help: "A customer asked to return items.", template: "ADMIN_ORDER_UPDATE", defaultOn: true },
  REFUND_INITIATED: { label: "Refund initiated", help: "A refund was started.", template: "ADMIN_ORDER_UPDATE", defaultOn: false },
  REFUND_COMPLETED: { label: "Refund completed", help: "A refund was completed.", template: "ADMIN_ORDER_UPDATE", defaultOn: false },
};
export const ADMIN_EVENT_LABELS = {
  NEW_ORDER: "New order received",
  PAYMENT_SUCCESS: "Online payment successful",
  PAYMENT_FAILED: "Payment failed",
  ORDER_CANCELLED: "Order cancelled",
  ORDER_SHIPPED: "Order shipped",
  OUT_FOR_DELIVERY: "Order out for delivery",
  DELIVERED: "Order delivered",
  RETURN_REQUESTED: "Return requested",
  REFUND_INITIATED: "Refund initiated",
  REFUND_COMPLETED: "Refund completed",
};
// Customer email event -> Admin event (the customer-side events already fire from every source: checkout,
// payment confirmation, Admin status change, courier webhook, refunds).
export const ADMIN_EVENT_FOR_CUSTOMER_EVENT = {
  ORDER_PLACED: "NEW_ORDER",
  ORDER_CANCELLED: "ORDER_CANCELLED",
  ORDER_SHIPPED: "ORDER_SHIPPED",
  ORDER_OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  ORDER_DELIVERED: "DELIVERED",
  REFUND_INITIATED: "REFUND_INITIATED",
  REFUND_COMPLETED: "REFUND_COMPLETED",
};

export const TEMPLATE_KEYS = Object.keys(EMAIL_TEMPLATES);

// Order status -> email event. CONFIRMED has no status email: the order confirmation is its own event.
export const EVENT_FOR_ORDER_STATUS = {
  PROCESSING: "ORDER_PROCESSING",
  SHIPPED: "ORDER_SHIPPED",
  OUT_FOR_DELIVERY: "ORDER_OUT_FOR_DELIVERY",
  DELIVERED: "ORDER_DELIVERED",
  CANCELLED: "ORDER_CANCELLED",
};

// Substitutes {{name}} placeholders from `vars`. Only whitelisted names are ever read; anything else
// becomes an empty string. Pure string replacement: there is no expression evaluation of any kind.
export function fillPlaceholders(text, vars = {}) {
  return String(text ?? "").replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_m, name) => (ALLOWED_VARIABLES.has(name) && vars[name] != null ? String(vars[name]) : ""));
}

// Names used in a piece of text that are not whitelisted (for Admin validation).
export function unknownPlaceholders(text) {
  const bad = new Set();
  for (const m of String(text ?? "").matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)) if (!ALLOWED_VARIABLES.has(m[1])) bad.add(m[1]);
  return [...bad];
}

export const SAMPLE_VARIABLES = {
  customerName: "Asha Verma",
  firstName: "Asha",
  orderNumber: "TUS-2026-000123",
  orderDate: "24 Oct 2026",
  orderTotal: "₹1,089",
  paymentMethod: "Cash on Delivery",
  trackingNumber: "141123221084922",
  courierName: "Delhivery",
  trackingUrl: "https://example.com/track/141123221084922",
  accountUrl: "https://example.com/account",
  orderUrl: "https://example.com/account/orders/TUS-2026-000123",
  supportEmail: "support@example.com",
  brandName: "Tushaqsa",
  cancellationReason: "Item out of stock",
  loginCode: "482913",
  expiresInMinutes: "10",
  resetUrl: "https://example.com/reset-password?token=sample",
  refundAmount: "₹500",
  eventLabel: "New order received",
  customerEmail: "asha@example.com",
  customerPhone: "+91 98765 43210",
  paymentStatus: "Pending (pay on delivery)",
  orderStatus: "Shipped",
  shippingLocation: "Jaipur, Rajasthan",
  adminOrderUrl: "https://example.com/admin/orders/sample",
  returnReason: "Item arrived damaged",
};
