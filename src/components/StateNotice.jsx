// Shared loading / error / empty presentation for API-backed sections —
// every storefront page uses one of these instead of leaving a blank gap.
export function LoadingNotice({ label = "Loading…" }) {
  return (
    <div className="flex items-center justify-center py-20 text-sm text-charcoal-soft">
      <span className="animate-pulse">{label}</span>
    </div>
  );
}

export function ErrorNotice({ message = "Unable to load this right now.", onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <p className="text-sm text-terracotta">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-full border border-charcoal/20 px-4 py-2 text-sm text-charcoal hover:border-charcoal/40"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyNotice({ message = "Nothing to show yet." }) {
  return (
    <div className="flex items-center justify-center py-20 text-center text-sm text-charcoal-soft">
      {message}
    </div>
  );
}
