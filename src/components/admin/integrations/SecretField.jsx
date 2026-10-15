import { useId } from "react";
import { StatusBadge } from "../ui";

// Write-only secret input shared by every provider card. A saved secret is never
// sent to the browser, so this shows only its state (Configured + last 4 characters)
// and lets Admin type a replacement. Leaving the input empty keeps the stored value.
export default function SecretField({ label, configured, mask, value, onChange, error, placeholder, children }) {
  const id = useId();
  return (
    <div className="admin-label">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={id}>{label}</label>
        <StatusBadge tone={configured ? "success" : "neutral"}>{configured ? "Configured" : "Not configured"}</StatusBadge>
        {configured && mask ? <span className="font-mono text-xs text-charcoal-soft">{mask}</span> : null}
      </div>
      <input
        id={id}
        type="password"
        autoComplete="new-password"
        value={value}
        onChange={onChange}
        placeholder={placeholder || (configured ? "Enter a new value to replace" : "")}
        className="admin-input"
      />
      {error && (
        <span role="alert" className="mt-1 block text-xs text-terracotta">
          {error}
        </span>
      )}
      {children}
    </div>
  );
}
