import React, { useEffect, useState } from "react";
import { resolveMediaUrl } from "../lib/api";
import { isSafeFooterUrl } from "../lib/footerUrls";
import { SafeFooterLink } from "./FooterSections";

const text = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * Full-width decorative artwork band placed at the very bottom of the footer.
 * Fully controlled by Admin CMS settings (fit modes, crop/focal positioning, responsive heights,
 * seam fine-tuning, decorative accessibility mode, optional link).
 * Renders null gracefully if disabled or if media fails to load.
 */
export default function FooterArtwork({ artwork }) {
  const desktop = text(artwork?.desktopImage);
  const mobile = text(artwork?.mobileImage);
  const primarySrc = desktop || mobile;

  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [desktop, mobile]);

  if (!artwork || artwork.enabled !== true || !primarySrc || failed) {
    return null;
  }

  const isDecorative = artwork.isDecorative === true;
  const altText = isDecorative ? "" : text(artwork.alt);

  const fit = ["cover", "contain", "natural"].includes(artwork.fit) ? artwork.fit : "cover";

  const desktopHeight = Number(artwork.desktopHeight) > 0 ? Number(artwork.desktopHeight) : 340;
  const tabletHeight = Number(artwork.tabletHeight) > 0 ? Number(artwork.tabletHeight) : 280;
  const mobileHeight = Number(artwork.mobileHeight) > 0 ? Number(artwork.mobileHeight) : 220;
  const minHeight = Number(artwork.minHeight) > 0 ? Number(artwork.minHeight) : undefined;
  const maxHeight = Number(artwork.maxHeight) > 0 ? Number(artwork.maxHeight) : undefined;

  const posX = typeof artwork.positionX === "number" && !isNaN(artwork.positionX) ? Math.min(100, Math.max(0, artwork.positionX)) : 50;
  const posY = typeof artwork.positionY === "number" && !isNaN(artwork.positionY) ? Math.min(100, Math.max(0, artwork.positionY)) : 50;
  const objectPosition = `${posX}% ${posY}%`;

  const offX = typeof artwork.offsetX === "number" && !isNaN(artwork.offsetX) ? Math.min(20, Math.max(-20, artwork.offsetX)) : 0;
  const offY = typeof artwork.offsetY === "number" && !isNaN(artwork.offsetY) ? Math.min(20, Math.max(-20, artwork.offsetY)) : 0;
  const transform = offX || offY ? `translate3d(${offX}px, ${offY}px, 0)` : undefined;

  const topSpacing = typeof artwork.topSpacing === "number" && !isNaN(artwork.topSpacing) ? Math.min(40, Math.max(-40, artwork.topSpacing)) : 0;
  const marginTop = topSpacing ? `${topSpacing}px` : undefined;

  const bgColor = text(artwork.backgroundColor) || undefined;

  const link = text(artwork.linkUrl);
  const hasLink = Boolean(link && isSafeFooterUrl(link));
  const openInNewTab = artwork.openInNewTab === true;

  const naturalMaxHeight = maxHeight ? `${maxHeight}px` : "700px";

  const imgEl = (
    <img
      src={resolveMediaUrl(primarySrc)}
      alt={altText}
      aria-hidden={isDecorative ? "true" : undefined}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`w-full block ${fit === "natural" ? "h-auto" : "h-full"}`}
      style={{
        objectFit: fit === "cover" ? "cover" : "contain",
        objectPosition,
        transform,
        maxHeight: fit === "natural" ? naturalMaxHeight : undefined,
      }}
    />
  );

  const pictureEl = mobile && desktop && mobile !== desktop ? (
    <picture className={`block w-full ${fit === "natural" ? "h-auto" : "h-full"}`}>
      <source media="(max-width: 767px)" srcSet={resolveMediaUrl(mobile)} />
      {imgEl}
    </picture>
  ) : (
    imgEl
  );

  const content = hasLink ? (
    openInNewTab ? (
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta"
        aria-label={altText || (isDecorative ? "Footer artwork link" : undefined)}
      >
        {pictureEl}
      </a>
    ) : (
      <SafeFooterLink
        url={link}
        className="block w-full h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta"
        aria-label={altText || (isDecorative ? "Footer artwork link" : undefined)}
      >
        {pictureEl}
      </SafeFooterLink>
    )
  ) : (
    pictureEl
  );

  return (
    <div
      data-testid="footer-artwork"
      className={`footer-artwork relative w-full overflow-hidden block ${fit === "natural" ? "h-auto" : "footer-artwork-frame"}`}
      style={{
        backgroundColor: bgColor,
        marginTop,
        "--fa-h-mobile": `${mobileHeight}px`,
        "--fa-h-tablet": `${tabletHeight}px`,
        "--fa-h-desktop": `${desktopHeight}px`,
        minHeight: minHeight ? `${minHeight}px` : undefined,
        maxHeight: fit === "natural" ? naturalMaxHeight : (maxHeight ? `${maxHeight}px` : undefined),
      }}
    >
      {content}
    </div>
  );
}

