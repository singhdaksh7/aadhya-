const TONE_MAP = {
  PAID: "success",
  CONFIRMED: "success",
  DELIVERED: "success",
  ACTIVE: "success",
  SHIPPED: "info",
  PROCESSING: "info",
  PENDING: "neutral",
  FAILED: "danger",
  CANCELLED: "danger",
  REFUNDED: "danger",
  PARTIALLY_REFUNDED: "danger",
  INACTIVE: "neutral",
  DRAFT: "neutral",
  PUBLISHED: "success",
};

export function StatusBadge({ value, tone, children, className = "" }) {
  const label = children ?? value ?? "—";
  const resolved = tone || TONE_MAP[String(value || "").toUpperCase()] || "neutral";
  return (
    <span className={`admin-badge admin-badge--${resolved} ${className}`}>
      {typeof label === "string" ? label.replace(/_/g, " ") : label}
    </span>
  );
}
