// Export centralized mock catalog products for full site compatibility
import { MOCK_PRODUCTS } from "../mocks/products";
import { MOCK_CATEGORIES } from "../mocks/categories";

export const products = MOCK_PRODUCTS;

export const productCategories = [
  "All",
  ...MOCK_CATEGORIES.map((c) => c.name)
];
