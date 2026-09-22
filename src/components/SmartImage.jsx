import { useState } from "react";
import Placeholder from "./Placeholder";

// Renders a real demo photo inside a fixed aspect-ratio box (no layout shift).
// Falls back to the generated Placeholder if the external image ever fails to load.
export default function SmartImage({
  image,
  tone = "sage",
  ratio = "aspect-[4/3]",
  className = "",
  priority = false,
  rounded = "rounded-2xl",
  label,
}) {
  const [failed, setFailed] = useState(false);

  if (!image || failed) {
    return <Placeholder tone={tone} ratio={ratio} className={className} label={label} />;
  }

  return (
    <div className={`overflow-hidden ${rounded} ${ratio} ${className}`}>
      <img
        src={image.src}
        alt={image.alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
