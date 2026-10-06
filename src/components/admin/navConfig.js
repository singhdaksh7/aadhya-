/**
 * Larkon-inspired grouped admin navigation, mapped to real Aadya routes.
 * Nested `children` render as expandable groups in the sidebar.
 */
export const adminNavGroups = [
  {
    title: "General",
    items: [{ to: "/admin", label: "Dashboard", end: true }],
  },
  {
    title: "Catalog",
    items: [
      {
        to: "/admin/products",
        label: "Products",
        end: true,
        children: [
          { to: "/admin/products", label: "All Products", end: true },
          { to: "/admin/products/new", label: "Add Product" },
        ],
      },
      { to: "/admin/categories", label: "Categories" },
      { to: "/admin/collections", label: "Collections" },
      { to: "/admin/inventory", label: "Inventory" },
    ],
  },
  {
    title: "Sales",
    items: [
      { to: "/admin/orders", label: "Orders" },
      { to: "/admin/returns", label: "Returns" },
      {
        to: "/admin/invoices",
        label: "Invoices",
        end: true,
        children: [
          { to: "/admin/invoices", label: "All Invoices", end: true },
          { to: "/admin/invoices/settings", label: "Invoice Settings" },
        ],
      },
      { to: "/admin/coupons", label: "Coupons" },
      { to: "/admin/customers", label: "Customers" },
      { to: "/admin/reviews", label: "Reviews" },
    ],
  },
  {
    title: "Content",
    items: [
      { to: "/admin/homepage-builder", label: "Homepage Builder" },
      { to: "/admin/header-settings", label: "Header & Navigation" },
      { to: "/admin/banners", label: "Banners" },
      { to: "/admin/promos", label: "Promos" },
      { to: "/admin/pages", label: "CMS Pages" },
      { to: "/admin/blog", label: "Blog" },
      { to: "/admin/faqs", label: "FAQ" },
      { to: "/admin/media", label: "Media Library" },
      { to: "/admin/navigation", label: "Navigation" },
    ],
  },
  {
    title: "Operations",
    items: [
      { to: "/admin/shipping", label: "Shipping" },
      { to: "/admin/integrations", label: "Integrations" },
    ],
  },
  {
    title: "Analytics",
    items: [{ to: "/admin/analytics", label: "Analytics" }],
  },
  {
    title: "System",
    items: [
      { to: "/admin/notifications", label: "Notifications" },
      { to: "/admin/settings", label: "Settings" },
      { to: "/admin/system-health", label: "System Health" },
    ],
  },
];

export function pageTitleFromPath(pathname) {
  const map = {
    "/admin": "Dashboard",
    "/admin/products": "Products",
    "/admin/products/new": "Add Product",
    "/admin/categories": "Categories",
    "/admin/collections": "Collections",
    "/admin/inventory": "Inventory",
    "/admin/orders": "Orders",
    "/admin/returns": "Returns",
    "/admin/invoices": "Invoices",
    "/admin/invoices/settings": "Invoice Settings",
    "/admin/coupons": "Coupons",
    "/admin/customers": "Customers",
    "/admin/reviews": "Reviews",
    "/admin/homepage-builder": "Homepage Builder",
    "/admin/header-settings": "Header & Navigation",
    "/admin/storefront/header": "Header & Navigation",
    "/admin/banners": "Banners",
    "/admin/promos": "Promos",
    "/admin/pages": "CMS Pages",
    "/admin/blog": "Blog",
    "/admin/faqs": "FAQ",
    "/admin/media": "Media Library",
    "/admin/navigation": "Navigation",
    "/admin/shipping": "Shipping",
    "/admin/integrations": "Integrations",
    "/admin/analytics": "Analytics",
    "/admin/settings": "Settings",
    "/admin/system-health": "System Health",
    "/admin/notifications": "Notifications",
  };
  if (map[pathname]) return map[pathname];
  if (pathname.startsWith("/admin/orders/")) return "Order Detail";
  if (pathname.startsWith("/admin/returns/")) return "Return Detail";
  if (pathname.startsWith("/admin/products/")) return "Edit Product";
  if (pathname.startsWith("/admin/customers/")) return "Customer Detail";
  return "Admin";
}
