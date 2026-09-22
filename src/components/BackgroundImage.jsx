import { useState } from "react";

// Full-bleed background photo for a section; hides itself on error so the
// section's own background color shows through instead of a broken image.
export default function BackgroundImage({ image, className = "" }) {
  const [failed, setFailed] = useState(false);
  if (!image || failed) return null;
  return (
    <img
      src={image.src}
      alt=""
      role="presentation"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`absolute inset-0 h-full w-full object-cover ${className}`}
    />
  );
}
