import { describe, expect, test } from "vitest";
import { lowStock, packingList, summarise } from "../src/fulfilment.js";
import type { Order, StockItem } from "../src/types.js";

const now = new Date("2026-11-20T12:00:00Z");

function order(overrides: Partial<Order>): Order {
  return {
    id: "o",
    name: "#1",
    createdAt: "2026-11-20T10:00:00Z",
    country: "GB",
    shippingMethod: "Tracked 48",
    fulfilled: false,
    items: [{ title: "Bag", sku: "B", quantity: 1 }],
    ...overrides,
  };
}

describe("packingList", () => {
  test("keeps only unfulfilled orders, oldest first", () => {
    const list = packingList(
      [
        order({ name: "#3", createdAt: "2026-11-19T12:00:00Z" }),
        order({ name: "#1", createdAt: "2026-11-16T12:00:00Z" }),
        order({ name: "#2", createdAt: "2026-11-18T12:00:00Z", fulfilled: true }),
      ],
      now,
    );
    expect(list.map((entry) => entry.name)).toEqual(["#1", "#3"]);
  });

  test("counts whole days waiting and total items", () => {
    const [entry] = packingList(
      [
        order({
          createdAt: "2026-11-17T13:00:00Z",
          items: [
            { title: "A", sku: "A", quantity: 2 },
            { title: "B", sku: "B", quantity: 1 },
          ],
        }),
      ],
      now,
    );
    expect(entry?.ageDays).toBe(2);
    expect(entry?.itemCount).toBe(3);
  });

  test("an order placed after 'now' (clock skew) is 0 days old, not negative", () => {
    const [entry] = packingList([order({ createdAt: "2026-11-20T13:00:00Z" })], now);
    expect(entry?.ageDays).toBe(0);
  });

  test("does not change the input", () => {
    const input = [order({ name: "#2" }), order({ name: "#1", createdAt: "2026-11-01T00:00:00Z" })];
    const copy = structuredClone(input);
    packingList(input, now);
    expect(input).toEqual(copy);
  });

  test("empty in, empty out", () => {
    expect(packingList([], now)).toEqual([]);
  });
});

describe("lowStock", () => {
  const stock: StockItem[] = [
    { title: "Coffee", sku: "C", quantity: 4 },
    { title: "Moon", sku: "M", quantity: 0 },
    { title: "Barrel", sku: "B", quantity: 2 },
    { title: "Apple", sku: "A", quantity: 2 },
  ];

  test("keeps items at or below the threshold, emptiest first, then by title", () => {
    expect(lowStock(stock, 2).map((item) => item.title)).toEqual(["Moon", "Apple", "Barrel"]);
  });

  test("marks sold-out items", () => {
    expect(lowStock(stock, 2).find((item) => item.title === "Moon")?.soldOut).toBe(true);
    expect(lowStock(stock, 2).find((item) => item.title === "Apple")?.soldOut).toBe(false);
  });
});

describe("summarise", () => {
  test("adds up what needs packing and what is running out", () => {
    const summary = summarise(
      [
        order({ createdAt: "2026-11-17T12:00:00Z", items: [{ title: "A", sku: "A", quantity: 2 }] }),
        order({ createdAt: "2026-11-20T09:00:00Z" }),
        order({ fulfilled: true }),
      ],
      [
        { title: "A", sku: "A", quantity: 0 },
        { title: "B", sku: "B", quantity: 1 },
        { title: "C", sku: "C", quantity: 9 },
      ],
      now,
      2,
    );
    expect(summary).toEqual({ ordersToPack: 2, itemsToPack: 3, oldestAgeDays: 3, lowStockCount: 2, soldOutCount: 1 });
  });

  test("oldest age is null when nothing needs packing", () => {
    expect(summarise([], [], now, 2).oldestAgeDays).toBeNull();
  });
});
