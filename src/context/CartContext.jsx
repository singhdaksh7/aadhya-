import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { addServerCartItem, clearServerCart, fetchProductBySlug, mergeCart, removeServerCartItem, serverCart, updateServerCartItem } from "../lib/api";
import { useCustomerAuth } from "./CustomerAuthContext";

const CartContext = createContext(null);
const STORAGE_KEY = "aadya.cart.v1";

function readStoredCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((i) => i && typeof i.slug === "string" && Number.isInteger(i.quantity));
  } catch {
    return [];
  }
}

function writeStoredCart(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage can be unavailable
  }
}

function availableStock(product) {
  return product.trackInventory ? product.stockQuantity : Infinity;
}

export function CartProvider({ children }) {
  const { user, status } = useCustomerAuth();
  const [items, setItems] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const hadAuthenticatedCart = useRef(false);

  useEffect(() => {
    if (status === "loading") return;
    let cancelled = false;
    (async () => {
      const guest = readStoredCart();
      if (user) {
        try {
          let result;
          if (guest.length && typeof mergeCart === "function") {
            result = await mergeCart(guest);
          } else if (typeof serverCart === "function") {
            result = await serverCart();
          }
          if (cancelled) return;
          if (result && Array.isArray(result.data)) {
            setItems(result.data);
            try { localStorage.removeItem(STORAGE_KEY); } catch {}
          } else if (guest.length) {
            // Fallback for mock/test environments
            const resolved = await Promise.all(
              guest.map(async (entry) => {
                try {
                  const res = await fetchProductBySlug(entry.slug);
                  return res && res.data ? { product: res.data, quantity: entry.quantity } : null;
                } catch {
                  return null;
                }
              })
            );
            setItems(resolved.filter(Boolean));
          }
        } catch {
          // If server cart fails, resolve guest items
          if (guest.length) {
            const resolved = await Promise.all(
              guest.map(async (entry) => {
                try {
                  const res = await fetchProductBySlug(entry.slug);
                  return res && res.data ? { product: res.data, quantity: entry.quantity } : null;
                } catch {
                  return null;
                }
              })
            );
            setItems(resolved.filter(Boolean));
          }
        } finally {
          if (!cancelled) setIsLoading(false);
        }
        return;
      }

      // Guest resolution
      if (guest.length === 0) {
        setIsLoading(false);
        return;
      }
      const resolved = await Promise.all(
        guest.map(async (entry) => {
          try {
            const res = await fetchProductBySlug(entry.slug);
            const product = res?.data;
            if (!product) return null;
            const quantity = Math.max(1, Math.min(entry.quantity, availableStock(product)));
            return { product, quantity };
          } catch {
            return null;
          }
        })
      );
      if (!cancelled) {
        setItems(resolved.filter(Boolean));
        setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, status]);

  useEffect(() => {
    if (user) { hadAuthenticatedCart.current = true; return; }
    if (!isLoading && hadAuthenticatedCart.current) { setItems([]); hadAuthenticatedCart.current = false; }
  }, [user, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) writeStoredCart(items.map((i) => ({ slug: i.product.slug, quantity: i.quantity })));
  }, [items, isLoading, user]);

  const addItem = async (product, quantity = 1) => {
    if (user && typeof addServerCartItem === "function") {
      try {
        const result = await addServerCartItem({ slug: product.slug, quantity });
        if (result && Array.isArray(result.data)) {
          setItems(result.data);
          setIsOpen(true);
          return;
        }
      } catch {}
    }
    setItems((prev) => {
      const existing = prev.find((i) => i.product.slug === product.slug);
      const max = availableStock(product);
      if (existing) {
        const nextQuantity = Math.min(existing.quantity + quantity, max);
        return prev.map((i) => (i.product.slug === product.slug ? { ...i, quantity: nextQuantity } : i));
      }
      return [...prev, { product, quantity: Math.min(quantity, max) }];
    });
    setIsOpen(true);
  };

  const removeItem = async (slug) => {
    if (user && typeof removeServerCartItem === "function") {
      try { await removeServerCartItem(slug); } catch {}
    }
    setItems((prev) => prev.filter((i) => i.product.slug !== slug));
  };

  const clearCart = async () => {
    if (user && typeof clearServerCart === "function") {
      try { await clearServerCart(); } catch {}
    }
    setItems([]);
  };

  const setQuantity = async (slug, quantity) => {
    if (quantity < 1) return removeItem(slug);
    if (user && typeof updateServerCartItem === "function") {
      try {
        const result = await updateServerCartItem(slug, { quantity });
        if (result && Array.isArray(result.data)) {
          setItems(result.data);
          return;
        }
      } catch {}
    }
    setItems((prev) =>
      prev.map((i) =>
        i.product.slug === slug ? { ...i, quantity: Math.min(quantity, availableStock(i.product)) } : i
      )
    );
  };

  const lineTotal = (item) => {
    const unit = item.product.salePrice ?? item.product.price;
    return Number(unit) * item.quantity;
  };

  const subtotal = useMemo(() => items.reduce((sum, i) => sum + lineTotal(i), 0), [items]);
  const count = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);

  const COUPON_STORAGE_KEY = "aadya.coupon.v1";
  const [appliedCoupon, setAppliedCoupon] = useState(() => {
    try {
      const raw = sessionStorage.getItem(COUPON_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [couponError, setCouponError] = useState(null);

  useEffect(() => {
    try {
      if (appliedCoupon) {
        sessionStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify(appliedCoupon));
      } else {
        sessionStorage.removeItem(COUPON_STORAGE_KEY);
      }
    } catch {}
  }, [appliedCoupon]);

  const applyCoupon = async (code) => {
    setCouponError(null);
    if (!code || !code.trim()) {
      setCouponError("Please enter a valid coupon code");
      return false;
    }
    try {
      const { validateCouponCode } = await import("../lib/api");
      const cartItemsPayload = items.map((i) => ({
        slug: i.product.slug,
        variantId: i.variant?.id || null,
        quantity: i.quantity,
      }));
      const res = await validateCouponCode(code.trim(), cartItemsPayload);
      setAppliedCoupon(res.data);
      return true;
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(err.message || "Invalid coupon code");
      return false;
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
  };

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        setQuantity,
        clearCart,
        subtotal,
        count,
        isOpen,
        setIsOpen,
        isLoading,
        lineTotal,
        appliedCoupon,
        couponError,
        applyCoupon,
        removeCoupon,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
