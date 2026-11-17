import type { Order, StockItem } from "./types.js";

/**
 * Made-up data shaped like a small handmade-bag shop. No real customers or orders.
 * Order times are stored as "hours before now" so the dashboard always looks current.
 */
type SampleOrder = Omit<Order, "createdAt"> & { hoursAgo: number };

export const sampleOrders: SampleOrder[] = [
  {
    id: "sample-1001",
    name: "#1001",
    hoursAgo: 75,
    country: "US",
    shippingMethod: "Express Shipping (duties included)",
    fulfilled: false,
    items: [{ title: "Coffee Barrel Bag", sku: "BAR-COF", quantity: 1 }],
  },
  {
    id: "sample-1002",
    name: "#1002",
    hoursAgo: 50,
    country: "GB",
    shippingMethod: "Royal Mail Tracked 48",
    fulfilled: false,
    items: [
      { title: "Madagascar Moon Bag", sku: "MOON-MAD", quantity: 1 },
      { title: "Cream Marble Baguette Bag", sku: "BAG-CRM", quantity: 1 },
    ],
  },
  {
    id: "sample-1003",
    name: "#1003",
    hoursAgo: 30,
    country: "US",
    shippingMethod: "Express Shipping (duties included)",
    fulfilled: true,
    items: [{ title: "Fuchsia Pink Barrel Bag", sku: "BAR-FUC", quantity: 1 }],
  },
  {
    id: "sample-1004",
    name: "#1004",
    hoursAgo: 6,
    country: "FR",
    shippingMethod: "International Tracked",
    fulfilled: false,
    items: [{ title: "Coffee Moon Bag", sku: "MOON-COF", quantity: 2 }],
  },
];

export const sampleStock: StockItem[] = [
  { title: "Coffee Barrel Bag", sku: "BAR-COF", quantity: 4 },
  { title: "Fuchsia Pink Barrel Bag", sku: "BAR-FUC", quantity: 1 },
  { title: "Madagascar Moon Bag", sku: "MOON-MAD", quantity: 0 },
  { title: "Coffee Moon Bag", sku: "MOON-COF", quantity: 2 },
  { title: "Cream Marble Baguette Bag", sku: "BAG-CRM", quantity: 6 },
];
