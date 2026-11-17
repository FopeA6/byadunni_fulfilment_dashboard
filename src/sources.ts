import { HOUR_MS } from "./fulfilment.js";
import { sampleOrders, sampleStock } from "./sample-data.js";
import type { DataSource, Order, StockItem } from "./types.js";

/** Serves the made-up data in sample-data.ts. Needs no credentials. */
export class SampleSource implements DataSource {
  constructor(private readonly now: () => Date = () => new Date()) {}

  async getOrders(): Promise<Order[]> {
    const nowMs = this.now().getTime();
    return sampleOrders.map(({ hoursAgo, ...order }) => ({
      ...order,
      createdAt: new Date(nowMs - hoursAgo * HOUR_MS).toISOString(),
    }));
  }

  async getStock(): Promise<StockItem[]> {
    return sampleStock.map((item) => ({ ...item }));
  }
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export type ShopifyConfig = {
  /** e.g. "your-store.myshopify.com" */
  store: string;
  accessToken: string;
  apiVersion: string;
};

const ORDERS_QUERY = `
  query OpenOrders {
    orders(first: 50, sortKey: CREATED_AT, query: "status:open fulfillment_status:unfulfilled") {
      nodes {
        id
        name
        createdAt
        displayFulfillmentStatus
        shippingAddress { countryCodeV2 }
        shippingLine { title }
        lineItems(first: 20) { nodes { title sku quantity } }
      }
    }
  }
`;

const STOCK_QUERY = `
  query Stock {
    products(first: 100, query: "status:active") {
      nodes {
        title
        variants(first: 20) { nodes { title sku inventoryQuantity } }
      }
    }
  }
`;

type OrdersResponse = {
  orders: {
    nodes: Array<{
      id: string;
      name: string;
      createdAt: string;
      displayFulfillmentStatus: string;
      shippingAddress: { countryCodeV2: string | null } | null;
      shippingLine: { title: string } | null;
      lineItems: { nodes: Array<{ title: string; sku: string | null; quantity: number }> };
    }>;
  };
};

type StockResponse = {
  products: {
    nodes: Array<{
      title: string;
      variants: { nodes: Array<{ title: string; sku: string | null; inventoryQuantity: number | null }> };
    }>;
  };
};

/**
 * Reads orders and stock from the Shopify Admin GraphQL API.
 *
 * Written against Shopify's documented schema and covered by tests with a mocked response, but not
 * run against a live store in this repo. Check the queries against the API version you use.
 */
export class ShopifySource implements DataSource {
  constructor(
    private readonly config: ShopifyConfig,
    private readonly fetchFn: FetchLike = fetch as unknown as FetchLike,
  ) {}

  private async query<T>(query: string): Promise<T> {
    const url = `https://${this.config.store}/admin/api/${this.config.apiVersion}/graphql.json`;
    const response = await this.fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": this.config.accessToken,
      },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) {
      throw new Error(`Shopify returned HTTP ${response.status}`);
    }
    const body = (await response.json()) as { data?: T; errors?: Array<{ message: string }> };
    if (body.errors && body.errors.length > 0) {
      throw new Error(`Shopify returned an error: ${body.errors.map((e) => e.message).join("; ")}`);
    }
    if (!body.data) {
      throw new Error("Shopify returned no data");
    }
    return body.data;
  }

  async getOrders(): Promise<Order[]> {
    const data = await this.query<OrdersResponse>(ORDERS_QUERY);
    return data.orders.nodes.map((node) => ({
      id: node.id,
      name: node.name,
      createdAt: node.createdAt,
      country: node.shippingAddress?.countryCodeV2 ?? "",
      shippingMethod: node.shippingLine?.title ?? "",
      fulfilled: node.displayFulfillmentStatus === "FULFILLED",
      items: node.lineItems.nodes.map((item) => ({
        title: item.title,
        sku: item.sku ?? "",
        quantity: item.quantity,
      })),
    }));
  }

  async getStock(): Promise<StockItem[]> {
    const data = await this.query<StockResponse>(STOCK_QUERY);
    return data.products.nodes.flatMap((product) =>
      product.variants.nodes.map((variant) => ({
        title: variant.title === "Default Title" ? product.title : `${product.title} (${variant.title})`,
        sku: variant.sku ?? "",
        quantity: variant.inventoryQuantity ?? 0,
      })),
    );
  }
}
