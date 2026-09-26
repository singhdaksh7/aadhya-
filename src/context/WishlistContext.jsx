import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useCustomerAuth } from "./CustomerAuthContext";
import { fetchWishlist, addToWishlist, removeFromWishlist } from "../lib/api";

const WishlistContext = createContext({
  wishlist: [],
  loading: false,
  isInWishlist: () => false,
  toggleWishlist: async () => {},
  refreshWishlist: async () => {},
});

export function WishlistProvider({ children }) {
  const { user, status } = useCustomerAuth();
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(false);

  const refreshWishlist = useCallback(async () => {
    if (status !== "authenticated" || !user) {
      setWishlist([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetchWishlist();
      setWishlist(res.data || []);
    } catch (err) {
      console.error("Failed to fetch wishlist:", err);
    } finally {
      setLoading(false);
    }
  }, [status, user]);

  useEffect(() => {
    if (status === "authenticated") {
      refreshWishlist();
    } else {
      setWishlist([]);
    }
  }, [status, refreshWishlist]);

  const isInWishlist = useCallback(
    (productId) => {
      if (!productId) return false;
      return wishlist.some((item) => item.productId === productId);
    },
    [wishlist]
  );

  const toggleWishlist = useCallback(
    async (productId, variantId = null) => {
      if (status !== "authenticated") {
        return { isGuest: true };
      }
      const existing = wishlist.find((item) => item.productId === productId);
      try {
        if (existing) {
          await removeFromWishlist(existing.id || productId);
          setWishlist((prev) => prev.filter((item) => item.productId !== productId));
        } else {
          const res = await addToWishlist(productId, variantId);
          await refreshWishlist();
          return { success: true, item: res.data };
        }
      } catch (err) {
        console.error("Failed to toggle wishlist item:", err);
        throw err;
      }
    },
    [status, wishlist, refreshWishlist]
  );

  return (
    <WishlistContext.Provider
      value={{
        wishlist,
        loading,
        isInWishlist,
        toggleWishlist,
        refreshWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  return useContext(WishlistContext);
}
