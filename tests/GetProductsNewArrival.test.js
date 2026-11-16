import { describe, it, expect, vi } from "vitest";

const fetchProducts = vi.fn(async () => ({ data: [] }));
vi.mock("../src/lib/api", async (orig) => ({ ...(await orig()), fetchProducts: (q) => fetchProducts(q) }));
import { getProducts } from "../src/services/api";

describe("getProducts newArrival", () => {
  it("passes newArrival=true to the server instead of filtering client-side", async () => {
    await getProducts({ newArrival: true, sortBy: "newest" });
    expect(fetchProducts).toHaveBeenLastCalledWith(expect.objectContaining({ newArrival: "true", sort: "newest" }));
  });
  it("omits it by default", async () => {
    await getProducts({});
    expect(fetchProducts.mock.calls.at(-1)[0]).not.toHaveProperty("newArrival");
  });
});
