import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "./context/CartContext";
import { WishlistProvider } from "./context/WishlistContext";
import { BrochureProvider } from "./context/BrochureContext";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import { CustomerAuthProvider } from "./context/CustomerAuthContext";
import RequireCustomer from "./components/RequireCustomer";
import { Login, Account, Addresses, Orders, OrderDetail, Forgot, Reset, SetPassword, AccountWishlist, AccountReviews, AccountDownloads, AccountNotifications, AccountInvoices, AccountReturns, AccountReturnDetail } from "./pages/account/AccountPages";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import CartDrawer from "./components/CartDrawer";
import BrochureModal from "./components/BrochureModal";
import ScrollToTop from "./components/ScrollToTop";
import RequireAdmin from "./components/admin/RequireAdmin";
const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));

import Home from "./pages/Home";
import ContentHub from "./pages/ContentHub";
import Shop from "./pages/Shop";
const Testimonials = lazy(() => import("./pages/Testimonials"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Contact = lazy(() => import("./pages/Contact"));
const PaymentInfo = lazy(() => import("./pages/PaymentInfo"));
import SystemPage from "./pages/SystemPage";
import GiftingPage from "./pages/GiftingPage";
import NotFound from "./pages/NotFound";
import BooksStorefront from "./pages/shop/BooksStorefront";
import ProductCatalog from "./pages/shop/ProductCatalog";
import CategoryStorefront from "./pages/shop/CategoryStorefront";
import CollectionsHub from "./pages/shop/CollectionsHub";
import ProductDetail from "./pages/shop/ProductDetail";
const CartPage = lazy(() => import("./pages/CartPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const OrderConfirmation = lazy(() => import("./pages/OrderConfirmation"));
const PaymentReturn = lazy(() => import("./pages/PaymentReturn"));
const TrackOrder = lazy(() => import("./pages/TrackOrder"));

const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminProductList = lazy(() => import("./pages/admin/AdminProductList"));
const AdminProductForm = lazy(() => import("./pages/admin/AdminProductForm"));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories"));
const AdminCollections = lazy(() => import("./pages/admin/AdminCollections"));
const AdminCoupons = lazy(() => import("./pages/admin/AdminCoupons"));
const AdminWhatsNew = lazy(() => import("./pages/admin/AdminWhatsNew"));
import OffersPage from "./pages/OffersPage";
const AdminNavigation = lazy(() => import("./pages/admin/AdminNavigation"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminOrderList = lazy(() => import("./pages/admin/AdminOrderList"));
const AdminOrderDetail = lazy(() => import("./pages/admin/AdminOrderDetail"));
const AdminReturnList = lazy(() => import("./pages/admin/AdminReturnList"));
const AdminReturnDetail = lazy(() => import("./pages/admin/AdminReturnDetail"));
const AdminHomepageBuilder = lazy(() => import("./pages/admin/AdminHomepageBuilder"));
const AdminGifting = lazy(() => import("./pages/admin/AdminGifting"));
const AdminBulkInquiries = lazy(() => import("./pages/admin/AdminBulkInquiries"));
const AdminBanners = lazy(() => import("./pages/admin/AdminBanners"));
const AdminPromos = lazy(() => import("./pages/admin/AdminPromos"));
const AdminPopup = lazy(() => import("./pages/admin/AdminPopup"));
const AdminNewsletter = lazy(() => import("./pages/admin/AdminNewsletter"));
import PromoPopup from "./components/PromoPopup";
const AdminReviews = lazy(() => import("./pages/admin/AdminReviews"));
const AdminFilters = lazy(() => import("./pages/admin/AdminFilters"));

const CmsPage = lazy(() => import("./pages/CmsPage"));
const BlogList = lazy(() => import("./pages/BlogList"));
const BlogDetail = lazy(() => import("./pages/BlogDetail"));

const AdminPages = lazy(() => import("./pages/admin/AdminPages"));
const AdminBlog = lazy(() => import("./pages/admin/AdminBlog"));
const AdminFaq = lazy(() => import("./pages/admin/AdminFaq"));
const AdminMedia = lazy(() => import("./pages/admin/AdminMedia"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminIntegrations = lazy(() => import("./pages/admin/AdminIntegrations"));
const AdminEmailTemplates = lazy(() => import("./pages/admin/AdminEmailTemplates"));
const AdminEmailNotifications = lazy(() => import("./pages/admin/AdminEmailNotifications"));
const AdminSystemHealth = lazy(() => import("./pages/admin/AdminSystemHealth"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));
const AdminCustomers = lazy(() => import("./pages/admin/AdminCustomers"));
const AdminInvoices = lazy(() => import("./pages/admin/AdminInvoices"));
const AdminInvoiceCreate = lazy(() => import("./pages/admin/AdminInvoiceCreate"));
const AdminInvoiceDetail = lazy(() => import("./pages/admin/AdminInvoiceDetail"));
const AdminInvoiceSettings = lazy(() => import("./pages/admin/AdminInvoiceSettings"));
const AdminInventory = lazy(() => import("./pages/admin/AdminInventory"));
const AdminLowStock = lazy(() => import("./pages/admin/AdminLowStock"));
const AdminShipping = lazy(() => import("./pages/admin/AdminShipping"));
const AdminHeaderSettings = lazy(() => import("./pages/admin/AdminHeaderSettings"));
import SearchResults from "./pages/shop/SearchResults";
import { captureUtmFromUrl } from "./lib/attribution";
import { SiteDecorations } from "./components/DecorationLayer";
const AdminDecorations = lazy(() => import("./pages/admin/AdminDecorations"));

// Policy Pages Component
function SiteLayout() {
  return (
    <CartProvider>
      <WishlistProvider>
        <BrochureProvider>
          <ScrollToTop />
          <div className="storefront-theme isolate flex min-h-screen flex-col font-sans">
            <Navbar />
            <main className="relative flex-1">
              {/* Decorative Edge Artwork for entire-site / route-scoped placements. Mounted once, clipped to <main>. */}
              <SiteDecorations />
              <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" />}>
              <Routes>
                {/* Primary E-Commerce Storefront Routes */}
                <Route path="/" element={<Home />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/collections" element={<CollectionsHub />} />
                <Route path="/collections/:slug" element={<ProductCatalog title="Collection" isCollectionRoute />} />
                <Route path="/products/:slug" element={<ProductDetail />} />
                <Route path="/shop/:slug" element={<ProductDetail />} />
                <Route path="/shop/category/:slug" element={<CategoryStorefront />} />
                <Route path="/books" element={<BooksStorefront />} />
                <Route path="/shop/books" element={<BooksStorefront />} />
                <Route path="/new-arrivals" element={<ProductCatalog eyebrow="Fresh Drops" title="New Arrivals" />} />
                <Route path="/best-sellers" element={<ProductCatalog eyebrow="Customer Favorites" title="Best Sellers" />} />
                <Route path="/search" element={<SearchResults />} />

                {/* Dynamic CMS Page & Blog Routes */}
                <Route path="/pages/:slug" element={<CmsPage />} />
                <Route path="/blog" element={<BlogList />} />
                <Route path="/blog/:slug" element={<BlogDetail />} />

                {/* Cart & Checkout */}
                <Route path="/cart" element={<CartPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/order/:orderNumber/confirmation" element={<OrderConfirmation />} />
                <Route path="/payment/return" element={<PaymentReturn />} />
                <Route path="/track-order" element={<TrackOrder />} />

                {/* Customer Account Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Login register />} />
                <Route path="/forgot-password" element={<Forgot />} />
                <Route path="/reset-password" element={<Reset />} />
                <Route path="/account" element={<RequireCustomer><Account /></RequireCustomer>} />
                <Route path="/account/set-password" element={<RequireCustomer><SetPassword /></RequireCustomer>} />
                <Route path="/account/profile" element={<RequireCustomer><Account /></RequireCustomer>} />
                <Route path="/account/orders" element={<RequireCustomer><Orders /></RequireCustomer>} />
                <Route path="/account/orders/:orderNumber" element={<RequireCustomer><OrderDetail /></RequireCustomer>} />
                <Route path="/account/addresses" element={<RequireCustomer><Addresses /></RequireCustomer>} />
                <Route path="/account/wishlist" element={<RequireCustomer><AccountWishlist /></RequireCustomer>} />
                <Route path="/account/reviews" element={<RequireCustomer><AccountReviews /></RequireCustomer>} />
                <Route path="/account/downloads" element={<RequireCustomer><AccountDownloads /></RequireCustomer>} />
                <Route path="/account/invoices" element={<RequireCustomer><AccountInvoices /></RequireCustomer>} />
                <Route path="/account/returns" element={<RequireCustomer><AccountReturns /></RequireCustomer>} />
                <Route path="/account/returns/:id" element={<RequireCustomer><AccountReturnDetail /></RequireCustomer>} />
                <Route path="/account/notifications" element={<RequireCustomer><AccountNotifications /></RequireCustomer>} />

                {/* Informational & Policy Routes */}
                <Route path="/gifting" element={<GiftingPage />} />
                <Route path="/offers" element={<OffersPage />} />
                <Route path="/about" element={<SystemPage slug="about" eyebrow="About" fallbackTitle="About" />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/faq" element={<FAQ />} />
                <Route path="/shipping" element={<SystemPage slug="shipping" eyebrow="Customer Policies" fallbackTitle="Shipping & Delivery" />} />
                <Route path="/returns" element={<SystemPage slug="returns" eyebrow="Customer Policies" fallbackTitle="Returns & Exchanges" />} />
                <Route path="/privacy" element={<SystemPage slug="privacy" eyebrow="Legal" fallbackTitle="Privacy Policy" />} />
                <Route path="/terms" element={<SystemPage slug="terms" eyebrow="Legal" fallbackTitle="Terms & Conditions" />} />
                <Route path="/cancellation" element={<SystemPage slug="cancellation" eyebrow="Customer Policies" fallbackTitle="Cancellation Policy" />} />
                <Route path="/payments" element={<PaymentInfo />} />

                {/* Informational Pages */}
                {/* Optional pages managed in Admin → Pages. Unpublished/draft = normal 404 (no static fallback content). */}
                <Route path="/training" element={<SystemPage slug="training" eyebrow="Training" missing="notfound" />} />
                <Route path="/consultation" element={<SystemPage slug="consultation" eyebrow="Consultation" missing="notfound" />} />
                <Route path="/research" element={<SystemPage slug="research" eyebrow="Research" missing="notfound" />} />
                <Route path="/content" element={<ContentHub />} />
                <Route path="/events" element={<SystemPage slug="events" eyebrow="Events" missing="notfound" />} />
                <Route path="/thinkpod" element={<SystemPage slug="thinkpod" eyebrow="Thinkpod" missing="notfound" />} />
                <Route path="/testimonials" element={<Testimonials />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </main>
            <Footer />
          </div>
          <CartDrawer />
          <BrochureModal />
          <PromoPopup />
        </BrochureProvider>
      </WishlistProvider>
    </CartProvider>
  );
}

function AdminRoutes() {
  return (
    <AdminAuthProvider>
      <Suspense fallback={<div className="min-h-screen" aria-busy="true" />}>
      <Routes>
        <Route path="login" element={<AdminLogin />} />
        <Route
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="homepage-builder" element={<AdminHomepageBuilder />} />
          <Route path="gifting" element={<AdminGifting />} />
          <Route path="gifting/bulk-inquiries" element={<AdminBulkInquiries />} />
          <Route path="decorations" element={<AdminDecorations />} />
          <Route path="header-settings" element={<AdminHeaderSettings />} />
          <Route path="storefront/header" element={<AdminHeaderSettings />} />
          <Route path="banners" element={<AdminBanners />} />
          <Route path="promos" element={<AdminPromos />} />
          <Route path="popup" element={<AdminPopup />} />
          <Route path="newsletter" element={<AdminNewsletter />} />
          <Route path="products" element={<AdminProductList />} />
          <Route path="products/new" element={<AdminProductForm />} />
          <Route path="products/:id" element={<AdminProductForm />} />
          <Route path="inventory" element={<AdminInventory />} />
          <Route path="inventory/low-stock" element={<AdminLowStock />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="collections" element={<AdminCollections />} />
          <Route path="filters" element={<AdminFilters />} />
          <Route path="coupons" element={<AdminCoupons />} />
          <Route path="whats-new" element={<AdminWhatsNew />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="customers/:id" element={<AdminCustomers />} />
          <Route path="invoices" element={<AdminInvoices />} />
          <Route path="invoices/new" element={<AdminInvoiceCreate />} />
          <Route path="invoices/settings" element={<AdminInvoiceSettings />} />
          <Route path="invoices/:id" element={<AdminInvoiceDetail />} />
          <Route path="reviews" element={<AdminReviews />} />
          <Route path="navigation" element={<AdminNavigation />} />
          <Route path="pages" element={<AdminPages />} />
          <Route path="blog" element={<AdminBlog />} />
          <Route path="faqs" element={<AdminFaq />} />
          <Route path="media" element={<AdminMedia />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="orders" element={<AdminOrderList />} />
          <Route path="orders/:id" element={<AdminOrderDetail />} />
          <Route path="returns" element={<AdminReturnList />} />
          <Route path="returns/:id" element={<AdminReturnDetail />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="shipping" element={<AdminShipping />} />
          <Route path="integrations" element={<AdminIntegrations />} />
          <Route path="email-templates" element={<AdminEmailTemplates />} />
          <Route path="email-notifications" element={<AdminEmailNotifications />} />
          <Route path="system-health" element={<AdminSystemHealth />} />
          <Route path="notifications" element={<AdminNotifications />} />
        </Route>
      </Routes>
      </Suspense>
    </AdminAuthProvider>
  );
}

export default function App() {
  React.useEffect(() => {
    captureUtmFromUrl();
  }, []);

  return (
    <BrowserRouter>
      <CustomerAuthProvider>
        <Routes>
          <Route path="/admin/*" element={<AdminRoutes />} />
          <Route path="/*" element={<SiteLayout />} />
        </Routes>
      </CustomerAuthProvider>
    </BrowserRouter>
  );
}
