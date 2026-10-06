import React, { forwardRef } from "react";
import { NavLink } from "react-router-dom";

/**
 * Link used by the header nav. Internal destinations use the router; external
 * ones render a plain anchor with safe rel attributes.
 */
const NavAnchor = forwardRef(function NavAnchor(
  { to, external, openInNewTab, className, children, ...rest },
  ref
) {
  if (external) {
    const resolvedClass = typeof className === "function" ? className({ isActive: false }) : className;
    return (
      <a
        ref={ref}
        href={to}
        target={openInNewTab ? "_blank" : undefined}
        rel="noopener noreferrer"
        className={resolvedClass}
        {...rest}
      >
        {children}
      </a>
    );
  }
  return (
    <NavLink
      ref={ref}
      to={to}
      target={openInNewTab ? "_blank" : undefined}
      rel={openInNewTab ? "noopener noreferrer" : undefined}
      className={className}
      {...rest}
    >
      {children}
    </NavLink>
  );
});

export default NavAnchor;
