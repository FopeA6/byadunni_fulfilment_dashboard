export type LineItem = {
  title: string;
  sku: string;
  quantity: number;
};

export type Order = {
  id: string;
  /** The order number customers see, e.g. "#1406". */
  name: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
  /** Two-letter country code of the shipping address, e.g. "US". Empty if unknown. */
  country: string;
  shippingMethod: string;
  fulfilled: boolean;
  items: LineItem[];
};

export type StockItem = {
  title: string;
  sku: string;
  quantity: number;
};

export type Role = "owner" | "fulfilment";

/** Login names (Tailscale user logins) allowed in, grouped by role. */
export type RolesConfig = Record<Role, string[]>;

export type Identity = {
  login: string;
  name: string;
};

export interface DataSource {
  getOrders(): Promise<Order[]>;
  getStock(): Promise<StockItem[]>;
}
