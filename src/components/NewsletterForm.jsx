import React, { useRef, useState } from "react";
import { subscribeNewsletter } from "../lib/api";
import { trackNewsletterSignup } from "../lib/analytics";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Turns any failure into a sentence a visitor can act on (never a raw "Failed to fetch").
export function newsletterErrorMessage(err) {
  if (err?.status === 429) return "Too many attempts. Please wait a few minutes and try again.";
  if (err?.status === 400 && err.message) return err.message;
  if (typeof err?.status === "number") return "Something went wrong on our side. Please try again in a moment.";
  return "We couldn't reach the server. Please check your connection and try again.";
}

// Self-contained subscribe form for the homepage NEWSLETTER section: owns its state, validates before sending,
// ignores double submits, and shows every outcome (success, validation, rate limit, network, server).
export default function NewsletterForm({ settings = {} }) {
  const s = settings;
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (inFlight.current) return;
    const value = email.trim();
    if (!value) { setStatus("error"); setError("Please enter your email address."); return; }
    if (!EMAIL_RE.test(value)) { setStatus("error"); setError("Please enter a valid email address."); return; }
    inFlight.current = true;
    setStatus("loading");
    setError("");
    try {
      await subscribeNewsletter(value);
      trackNewsletterSignup({ source: "homepage" });
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(newsletterErrorMessage(err));
    } finally {
      inFlight.current = false;
    }
  }

  if (status === "success") {
    return <div role="status" className="mx-auto mt-6 max-w-md rounded-xl store-bg-secondary-soft p-4 text-xs font-medium store-secondary sm:text-sm">{s.successMessage || "Thank you for subscribing to Tushaqsa!"}</div>;
  }

  const loading = status === "loading";
  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto mt-6 max-w-md">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          name="email"
          autoComplete="email"
          aria-label="Email address"
          aria-invalid={status === "error" ? "true" : undefined}
          aria-describedby={status === "error" ? "newsletter-error" : undefined}
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (status === "error") { setStatus("idle"); setError(""); } }}
          placeholder={s.placeholder || "Enter your email address"}
          disabled={loading}
          className="min-w-0 flex-1 rounded-full border store-border store-bg px-5 py-3 text-base store-text sm:text-xs"
        />
        <button type="submit" disabled={loading} className="rounded-full store-bg-primary px-7 py-3 text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-60">
          {loading ? (s.loadingLabel || "Subscribing…") : (s.buttonLabel || "Subscribe")}
        </button>
      </div>
      {status === "error" && (
        <p id="newsletter-error" role="alert" className="mt-3 break-words text-xs font-medium text-red-700">
          {s.errorPrefix ? `${s.errorPrefix} ${error}` : error}
        </p>
      )}
    </form>
  );
}
