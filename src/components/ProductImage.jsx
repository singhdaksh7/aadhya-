import SmartImage from "./SmartImage";
import { resolveProductImageUrl } from "../lib/api";

const TONE_BY_TYPE = { BOOK: "green", PHYSICAL: "beige" };

export default function ProductImage({ product, image, className = "", ratio, priority, rounded }) {
  const chosen = image || product?.images?.find((i) => i.isPrimary) || product?.images?.[0];
  const resolved = chosen
    ? { src: resolveProductImageUrl(chosen.url), alt: chosen.altText || product?.name || "Product image" }
    : null;

  return (
    <SmartImage
      image={resolved}
      tone={TONE_BY_TYPE[product?.productType] || "beige"}
      ratio={ratio || (product?.productType === "BOOK" ? "aspect-[3/4]" : "aspect-square")}
      label={product?.name}
      className={className}
      priority={priority}
      rounded={rounded}
    />
  );
}
