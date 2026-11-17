import { describe, expect, test } from "vitest";
import { ShopifySource } from "../src/sources.js";

const config = { store: "example.myshopify.com", accessToken: "test-token", apiVersion: "2025-07" };

function fakeFetch(data: unknown, init: { ok?: boolean; status?: number; errors?: Array<{ message: string }> } = {}) {
  const calls: Array<{ url: string; headers: Record<string, string>; body: string }> = [];
  const fn = async (url: string, req: { method: string; headers: Record<string, string>; body: string }) => {
    calls.push({ url, headers: req.headers, body: req.body });
    return {
      ok: init.ok ?? true,
      status: init.status ?? 200,
      json: async () => ({ data, errors: init.errors }),
    };
  };
  return { fn, calls };
}

describe("ShopifySource", () => {
  test("calls the Admin GraphQL endpoint with the access token", async () => {
    const { fn, calls } = fakeFetch({ orders: { nodes: [] } });
    await new ShopifySource(config, fn).getOrders();
    expect(calls[0]?.url).toBe("https://example.myshopify.com/admin/api/2025-07/graphql.json");
    expect(calls[0]?.headers["X-Shopify-Access-Token"]).toBe("test-token");
  });

  test("maps orders into the app's shape, filling gaps safely", async () => {
    const { fn } = fakeFetch({
      orders: {
        nodes: [
          {
            id: "gid://shopify/Order/1",
            name: "#1406",
            createdAt: "2026-11-18T09:00:00Z",
            displayFulfillmentStatus: "UNFULFILLED",
            shippingAddress: { countryCodeV2: "US" },
            shippingLine: { title: "Express" },
            lineItems: { nodes: [{ title: "Coffee Barrel Bag", sku: null, quantity: 1 }] },
          },
          {
            id: "gid://shopify/Order/2",
            name: "#1407",
            createdAt: "2026-11-18T10:00:00Z",
            displayFulfillmentStatus: "FULFILLED",
            shippingAddress: null,
            shippingLine: null,
            lineItems: { nodes: [] },
          },
        ],
      },
    });
    const orders = await new ShopifySource(config, fn).getOrders();
    expect(orders[0]).toEqual({
      id: "gid://shopify/Order/1",
      name: "#1406",
      createdAt: "2026-11-18T09:00:00Z",
      country: "US",
      shippingMethod: "Express",
      fulfilled: false,
      items: [{ title: "Coffee Barrel Bag", sku: "", quantity: 1 }],
    });
    expect(orders[1]).toMatchObject({ country: "", shippingMethod: "", fulfilled: true, items: [] });
  });

  test("flattens product variants into stock lines", async () => {
    const { fn } = fakeFetch({
      products: {
        nodes: [
          { title: "Moon Bag", variants: { nodes: [{ title: "Coffee", sku: "MOON-COF", inventoryQuantity: 2 }, { title: "Madagascar", sku: "MOON-MAD", inventoryQuantity: null }] } },
          { title: "Clutch", variants: { nodes: [{ title: "Default Title", sku: "CLU", inventoryQuantity: 5 }] } },
        ],
      },
    });
    expect(await new ShopifySource(config, fn).getStock()).toEqual([
      { title: "Moon Bag (Coffee)", sku: "MOON-COF", quantity: 2 },
      { title: "Moon Bag (Madagascar)", sku: "MOON-MAD", quantity: 0 },
      { title: "Clutch", sku: "CLU", quantity: 5 },
    ]);
  });

  test("HTTP errors and GraphQL errors become readable exceptions", async () => {
    await expect(new ShopifySource(config, fakeFetch(null, { ok: false, status: 401 }).fn).getOrders()).rejects.toThrow(
      "HTTP 401",
    );
    await expect(
      new ShopifySource(config, fakeFetch(null, { errors: [{ message: "Access denied for orders field" }] }).fn).getOrders(),
    ).rejects.toThrow("Access denied for orders field");
  });
});
