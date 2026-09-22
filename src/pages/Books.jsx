import { Navigate } from "react-router-dom";

// The public IA still calls this "Books" in the navbar, but Books are
// Products (productType=BOOK) served by the same commerce engine as the
// Shop — so this route simply hands off to the shared catalog view.
export default function Books() {
  return <Navigate to="/shop/books" replace />;
}
