import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { CartProvider } from "./context/CartContext";
import { BrochureProvider } from "./context/BrochureContext";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import { CustomerAuthProvider } from "./context/CustomerAuthContext";
import RequireCustomer from "./components/RequireCustomer";
import { Login, Account, Addresses, Orders, OrderDetail, Forgot, Reset } from "./pages/account/AccountPages";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import CartDrawer from "./components/CartDrawer";
import BrochureModal from "./components/BrochureModal";
import ScrollToTop from "./components/ScrollToTop";
import RequireAdmin from "./components/admin/RequireAdmin";
import AdminLayout from "./components/admin/AdminLayout";

import Home from "./pages/Home";
import Training from "./pages/Training";
import ProgramDetail from "./pages/ProgramDetail";
import Consultation from "./pages/Consultation";
import About from "./pages/About";
import Research from "./pages/Research";
import ContentHub from "./pages/ContentHub";
import Events from "./pages/Events";
import Shop from "./pages/Shop";
import Thinkpod from "./pages/Thinkpod";
import Testimonials from "./pages/Testimonials";
import FAQ from "./pages/FAQ";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";
import BooksStorefront from "./pages/shop/BooksStorefront";
import ProductCatalog from "./pages/shop/ProductCatalog";
import CollectionsHub from "./pages/shop/CollectionsHub";
import ProductDetail from "./pages/shop/ProductDetail";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import OrderConfirmation from "./pages/OrderConfirmation";
import TrackOrder from "./pages/TrackOrder";

import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProductList from "./pages/admin/AdminProductList";
import AdminProductForm from "./pages/admin/AdminProductForm";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminCollections from "./pages/admin/AdminCollections";
import AdminCoupons from "./pages/admin/AdminCoupons";
import AdminNavigation from "./pages/admin/AdminNavigation";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminOrderList from "./pages/admin/AdminOrderList";
import AdminOrderDetail from "./pages/admin/AdminOrderDetail";
import AdminHomepageBuilder from "./pages/admin/AdminHomepageBuilder";
import AdminBanners from "./pages/admin/AdminBanners";
import AdminPromos from "./pages/admin/AdminPromos";

// Policy Pages Component
function PolicyPage({ title, eyebrow = "Customer Policies", children }) {
  return (
    <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 space-y-6">
      <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">{eyebrow}</span>
      <h1 className="font-serif-display text-3xl sm:text-4xl text-charcoal">{title}</h1>
      <div className="prose prose-stone text-sm leading-relaxed text-charcoal-soft space-y-4 border-t border-charcoal/10 pt-6">
        {children}
      </div>
    </div>
  );
}

function SiteLayout() {
  return (
    <CartProvider>
      <BrochureProvider>
        <ScrollToTop />
        <div className="flex min-h-screen flex-col bg-white text-charcoal font-sans">
          <Navbar />
          <main className="flex-1">
            <Routes>
              {/* Primary E-Commerce Storefront Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/collections" element={<CollectionsHub />} />
              <Route path="/collections/:slug" element={<ProductCatalog title="Collection" isCollectionRoute />} />
              <Route path="/products/:slug" element={<ProductDetail />} />
              <Route path="/shop/:slug" element={<ProductDetail />} />
              <Route path="/shop/category/:slug" element={<ProductCatalog title="Category Catalog" />} />
              <Route path="/books" element={<BooksStorefront />} />
              <Route path="/shop/books" element={<BooksStorefront />} />
              <Route path="/new-arrivals" element={<ProductCatalog eyebrow="Fresh Drops" title="New Arrivals" />} />
              <Route path="/best-sellers" element={<ProductCatalog eyebrow="Customer Favorites" title="Best Sellers" />} />
              <Route path="/search" element={<ProductCatalog title="Search Storefront" />} />

              {/* Cart & Checkout */}
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/order/:orderNumber/confirmation" element={<OrderConfirmation />} />
              <Route path="/track-order" element={<TrackOrder />} />

              {/* Customer Account Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Login register />} />
              <Route path="/forgot-password" element={<Forgot />} />
              <Route path="/reset-password" element={<Reset />} />
              <Route path="/account" element={<RequireCustomer><Account /></RequireCustomer>} />
              <Route path="/account/profile" element={<RequireCustomer><Account /></RequireCustomer>} />
              <Route path="/account/orders" element={<RequireCustomer><Orders /></RequireCustomer>} />
              <Route path="/account/orders/:orderNumber" element={<RequireCustomer><OrderDetail /></RequireCustomer>} />
              <Route path="/account/addresses" element={<RequireCustomer><Addresses /></RequireCustomer>} />

              {/* Informational & Policy Routes */}
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/faq" element={<FAQ />} />
              <Route
                path="/shipping"
                element={
                  <PolicyPage title="Shipping & Delivery Policy">
                    <p>We offer Pan-India express courier dispatch for all Aadya home decor objects and books.</p>
                    <p>Orders are dispatched within 24-48 hours. Express transit usually takes 3-5 business days depending on pincode location.</p>
                    <p>Free standard delivery is offered on all domestic orders exceeding ₹2,499.</p>
                  </PolicyPage>
                }
              />
              <Route
                path="/returns"
                element={
                  <PolicyPage title="Returns & Exchange Policy">
                    <p>We stand behind the slow craftsmanship of every object we create. If your piece arrives damaged or defective, we offer hassle-free 7-day replacements.</p>
                    <p>Because items are handcrafted from natural minerals, wood, and clay, subtle variations in shade and texture are intrinsic to authentic artisan products.</p>
                  </PolicyPage>
                }
              />
              <Route
                path="/privacy"
                element={
                  <PolicyPage title="Privacy Policy">
                    <p>At Aadya, we respect your personal privacy. We do not sell or share customer data with third parties.</p>
                    <p>All transactions processed through our store are encrypted using industry-standard SSL security.</p>
                  </PolicyPage>
                }
              />
              <Route
                path="/terms"
                element={
                  <PolicyPage title="Terms of Service">
                    <p>Welcome to Aadya Storefront. By browsing or purchasing from our platform, you agree to our standard terms and conditions.</p>
                    <p>All editorial content, book excerpts, and visual designs are protected under intellectual property laws.</p>
                  </PolicyPage>
                }
              />

              {/* Informational Pages */}
              <Route path="/training" element={<Training />} />
              <Route path="/training/:slug" element={<ProgramDetail />} />
              <Route path="/consultation" element={<Consultation />} />
              <Route path="/research" element={<Research />} />
              <Route path="/content" element={<ContentHub />} />
              <Route path="/events" element={<Events />} />
              <Route path="/thinkpod" element={<Thinkpod />} />
              <Route path="/testimonials" element={<Testimonials />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <Footer />
        </div>
        <CartDrawer />
        <BrochureModal />
      </BrochureProvider>
    </CartProvider>
  );
}

function AdminRoutes() {
  return (
    <AdminAuthProvider>
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
          <Route path="banners" element={<AdminBanners />} />
          <Route path="promos" element={<AdminPromos />} />
          <Route path="products" element={<AdminProductList />} />
          <Route path="products/new" element={<AdminProductForm />} />
          <Route path="products/:id" element={<AdminProductForm />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="collections" element={<AdminCollections />} />
          <Route path="coupons" element={<AdminCoupons />} />
          <Route path="navigation" element={<AdminNavigation />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="orders" element={<AdminOrderList />} />
          <Route path="orders/:id" element={<AdminOrderDetail />} />
        </Route>
      </Routes>
    </AdminAuthProvider>
  );
}

export default function App() {
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
