import type { Order, StockItem } from "./types.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type PackingEntry = Order & {
  /** Whole days since the order was placed. */
  ageDays: number;
  itemCount: number;
};

export type StockAlert = StockItem & {
  soldOut: boolean;
};

export type Summary = {
  ordersToPack: number;
  itemsToPack: number;
  oldestAgeDays: number | null;
  lowStockCount: number;
  soldOutCount: number;
};

/** Unfulfilled orders, oldest first, so the longest-waiting customer is packed first. */
export function packingList(orders: Order[], now: Date): PackingEntry[] {
  return orders
    .filter((order) => !order.fulfilled)
    .map((order) => ({
      ...order,
      ageDays: Math.max(0, Math.floor((now.getTime() - Date.parse(order.createdAt)) / DAY_MS)),
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    }))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

/** Items at or below the threshold, emptiest first, then by title. */
export function lowStock(stock: StockItem[], threshold: number): StockAlert[] {
  return stock
    .filter((item) => item.quantity <= threshold)
    .map((item) => ({ ...item, soldOut: item.quantity <= 0 }))
    .sort((a, b) => a.quantity - b.quantity || a.title.localeCompare(b.title));
}

export function summarise(orders: Order[], stock: StockItem[], now: Date, threshold: number): Summary {
  const toPack = packingList(orders, now);
  const alerts = lowStock(stock, threshold);
  return {
    ordersToPack: toPack.length,
    itemsToPack: toPack.reduce((sum, entry) => sum + entry.itemCount, 0),
    oldestAgeDays: toPack.length > 0 ? toPack[0]!.ageDays : null,
    lowStockCount: alerts.length,
    soldOutCount: alerts.filter((alert) => alert.soldOut).length,
  };
}

export { HOUR_MS };
