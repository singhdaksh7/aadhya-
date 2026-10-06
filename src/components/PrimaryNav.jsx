import React, { useCallback, useEffect, useRef, useState } from "react";
import NavAnchor from "./NavAnchor";
import MegaMenu from "./MegaMenu";

const OPEN_DELAY_MS = 90; // hover intent
const CLOSE_DELAY_MS = 160; // forgiving travel time into the dropdown

/**
 * Desktop primary navigation + hover mega menu, driven entirely by the
 * normalized nav model (lib/navModel.js).
 *
 * `forcedOpenId` pins a menu open (admin preview).
 */
export default function PrimaryNav({
  items = [],
  maxColumns = 4,
  menuWidth = "full",
  showBadges = true,
  resetKey,
  forcedOpenId = null,
}) {
  const [openId, setOpenId] = useState(null);
  const timerRef = useRef(null);
  const containerRef = useRef(null);
  const triggerRefs = useRef({});

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => clearTimer, []);

  useEffect(() => {
    clearTimer();
    setOpenId(null);
  }, [resetKey]);

  const scheduleOpen = (id) => {
    clearTimer();
    // Already browsing menus: switch instantly, otherwise wait for hover intent.
    if (openId) {
      setOpenId(id);
      return;
    }
    timerRef.current = setTimeout(() => setOpenId(id), OPEN_DELAY_MS);
  };

  const scheduleClose = () => {
    clearTimer();
    timerRef.current = setTimeout(() => setOpenId(null), CLOSE_DELAY_MS);
  };

  const openIdRef = useRef(null);
  useEffect(() => {
    openIdRef.current = openId;
  }, [openId]);

  const closeMenu = useCallback(() => {
    clearTimer();
    const current = openIdRef.current;
    const panel = containerRef.current?.querySelector('[data-testid="mega-menu"]');
    // Keep keyboard users oriented: return focus to the trigger if it was inside the panel.
    if (current && panel && panel.contains(document.activeElement)) triggerRefs.current[current]?.focus();
    setOpenId(null);
  }, []);

  const activeId = forcedOpenId || openId;
  const activeItem = items.find((i) => i.id === activeId && i.hasMenu) || null;
  const menuId = activeItem ? `mega-menu-${activeItem.id}` : undefined;

  const handleBlur = (e) => {
    if (forcedOpenId) return;
    if (!e.currentTarget.contains(e.relatedTarget)) {
      clearTimer();
      setOpenId(null);
    }
  };

  const handleTriggerKeyDown = (e, item) => {
    if (e.key === "ArrowDown" && item.hasMenu) {
      e.preventDefault();
      setOpenId(item.id);
      // Wait for the panel to mount, then move focus to its first link.
      setTimeout(() => {
        containerRef.current?.querySelector('[data-testid="mega-menu"] a')?.focus();
      }, 0);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={clearTimer}
      onMouseLeave={forcedOpenId ? undefined : scheduleClose}
      onBlur={handleBlur}
    >
      <nav aria-label="Primary" className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-1 px-8 py-2.5">
        {items.map((item) => {
          const isOpen = activeItem?.id === item.id;
          return (
            <div
              key={item.id}
              className="relative py-1"
              onMouseEnter={() => (item.hasMenu ? scheduleOpen(item.id) : openId && scheduleClose())}
            >
              <NavAnchor
                ref={(node) => {
                  triggerRefs.current[item.id] = node;
                }}
                to={item.to}
                external={item.external}
                openInNewTab={item.openInNewTab}
                aria-haspopup={item.hasMenu ? "true" : undefined}
                aria-expanded={item.hasMenu ? isOpen : undefined}
                aria-controls={item.hasMenu && isOpen ? menuId : undefined}
                onFocus={() => {
                  if (forcedOpenId) return;
                  if (item.hasMenu) {
                    clearTimer();
                    setOpenId(item.id);
                  } else if (openId) {
                    setOpenId(null);
                  }
                }}
                onKeyDown={(e) => handleTriggerKeyDown(e, item)}
                className={({ isActive } = {}) =>
                  `inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors ${
                    isActive || isOpen
                      ? "store-primary border-b-2 border-[var(--theme-primary)] pb-0.5"
                      : "store-muted hover:store-primary"
                  }`
                }
              >
                <span>{item.label}</span>
                {showBadges && item.badge && (
                  <span className="store-bg-primary text-white text-[8px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                    {item.badge}
                  </span>
                )}
                {item.hasMenu && (
                  <svg className="h-3 w-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </NavAnchor>
            </div>
          );
        })}
      </nav>

      {activeItem && (
        <MegaMenu
          id={menuId}
          item={activeItem}
          isOpen
          onClose={closeMenu}
          maxColumns={maxColumns}
          width={menuWidth}
        />
      )}
    </div>
  );
}
