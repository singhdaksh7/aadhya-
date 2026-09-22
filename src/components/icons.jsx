// Minimal hand-drawn line icon set — keeps the demo dependency-free.
const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export const IconCompass = (p) => (
  <svg viewBox="0 0 24 24" width="28" height="28" {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M14.5 9.5 13 13l-3.5 1.5L11 11l3.5-1.5Z" />
  </svg>
);

export const IconLink = (p) => (
  <svg viewBox="0 0 24 24" width="28" height="28" {...base} {...p}>
    <path d="M9 12h6" />
    <path d="M10 7H7a5 5 0 0 0 0 10h3" />
    <path d="M14 7h3a5 5 0 0 1 0 10h-3" />
  </svg>
);

export const IconBook = (p) => (
  <svg viewBox="0 0 24 24" width="28" height="28" {...base} {...p}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" />
    <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20" />
  </svg>
);

export const IconLeaf = (p) => (
  <svg viewBox="0 0 24 24" width="28" height="28" {...base} {...p}>
    <path d="M5 19c8 0 14-6 14-14-8 0-14 6-14 14Z" />
    <path d="M5 19c0-5 3-9 8-11" />
  </svg>
);

export const IconHeart = (p) => (
  <svg viewBox="0 0 24 24" width="24" height="24" {...base} {...p}>
    <path d="M12 20s-7-4.35-9.5-8.6C.6 8 2 4.5 5.5 4A5 5 0 0 1 12 7a5 5 0 0 1 6.5-3c3.5.5 4.9 4 3 7.4C19 15.65 12 20 12 20Z" />
  </svg>
);

export const IconUsers = (p) => (
  <svg viewBox="0 0 24 24" width="24" height="24" {...base} {...p}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    <circle cx="17" cy="9" r="2.4" />
    <path d="M15.5 14a5.4 5.4 0 0 1 5.5 6" />
  </svg>
);

export const IconFlask = (p) => (
  <svg viewBox="0 0 24 24" width="24" height="24" {...base} {...p}>
    <path d="M10 3h4" />
    <path d="M10.5 3v6.5L5.5 18a2 2 0 0 0 1.7 3h9.6a2 2 0 0 0 1.7-3l-5-8.5V3" />
    <path d="M7.5 15h9" />
  </svg>
);

export const IconLayers = (p) => (
  <svg viewBox="0 0 24 24" width="24" height="24" {...base} {...p}>
    <path d="M12 3 3 8l9 5 9-5-9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </svg>
);

export const IconArrowRight = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...p}>
    <path d="M4 12h15" />
    <path d="m13 6 7 6-7 6" />
  </svg>
);

export const IconMenu = (p) => (
  <svg viewBox="0 0 24 24" width="24" height="24" {...base} {...p}>
    <path d="M4 7h16" />
    <path d="M4 12h16" />
    <path d="M4 17h16" />
  </svg>
);

export const IconClose = (p) => (
  <svg viewBox="0 0 24 24" width="24" height="24" {...base} {...p}>
    <path d="m5 5 14 14" />
    <path d="m19 5-14 14" />
  </svg>
);

export const IconCart = (p) => (
  <svg viewBox="0 0 24 24" width="22" height="22" {...base} {...p}>
    <circle cx="9" cy="20" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="17" cy="20" r="1.2" fill="currentColor" stroke="none" />
    <path d="M3 4h2l2.2 11.4A2 2 0 0 0 9.1 17h7.4a2 2 0 0 0 1.9-1.4L20 8H6" />
  </svg>
);

export const IconPlay = (p) => (
  <svg viewBox="0 0 24 24" width="24" height="24" {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M10 8.5v7l6-3.5-6-3.5Z" fill="currentColor" stroke="none" />
  </svg>
);

export const IconCheck = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...p}>
    <path d="m5 13 4 4 10-10" />
  </svg>
);

export const IconChevronDown = (p) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...base} {...p}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
