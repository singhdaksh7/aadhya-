const TONES = ["bg-sage-light text-green-deep", "bg-beige text-terracotta", "bg-green/10 text-green-deep"];

// Simple abstract initial avatar — used instead of fabricated testimonial photos.
export default function AvatarInitial({ name, className = "" }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const tone = TONES[(name?.length ?? 0) % TONES.length];
  return (
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-serif-display text-lg ${tone} ${className}`}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}
