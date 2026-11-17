import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, test } from "vitest";
import { createApp } from "../src/server.js";
import { SampleSource } from "../src/sources.js";
import type { DataSource } from "../src/types.js";

const roles = { owner: ["owner@example.com"], fulfilment: ["packer@example.com"] };
const now = () => new Date("2026-11-20T12:00:00Z");

let server: Server | undefined;

async function start(source: DataSource = new SampleSource(now)): Promise<string> {
  const handle = createApp({ source, roles, lowStockThreshold: 2, now });
  server = createServer((req, res) => void handle(req, res));
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
});

const as = (login: string) => ({ headers: { "Tailscale-User-Login": login, "Tailscale-User-Name": "Test User" } });

describe("access", () => {
  test("health check needs no identity", async () => {
    const base = await start();
    const res = await fetch(`${base}/healthz`);
    expect(res.status).toBe(200);
  });

  test("a request without Tailscale identity is turned away", async () => {
    const base = await start();
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(401);
    expect(await res.text()).toContain("Open this through Tailscale");
  });

  test("a tailnet user who is not on the list is refused", async () => {
    const base = await start();
    const res = await fetch(`${base}/`, as("stranger@example.com"));
    expect(res.status).toBe(403);
  });

  test("only GET is allowed", async () => {
    const base = await start();
    const res = await fetch(`${base}/`, { method: "POST", ...as("owner@example.com") });
    expect(res.status).toBe(405);
  });
});

describe("what each role sees", () => {
  test("the owner sees the summary, the packing list and low stock", async () => {
    const base = await start();
    const html = await (await fetch(`${base}/`, as("owner@example.com"))).text();
    expect(html).toContain("owner view");
    expect(html).toContain("orders to pack");
    expect(html).toContain("To pack (oldest first)");
    expect(html).toContain("Low stock");
    expect(html).toContain("Sold out");
  });

  test("the fulfilment partner sees only the packing list", async () => {
    const base = await start();
    const html = await (await fetch(`${base}/`, as("packer@example.com"))).text();
    expect(html).toContain("fulfilment view");
    expect(html).toContain("To pack (oldest first)");
    expect(html).not.toContain("Low stock");
    expect(html).not.toContain("orders to pack");
  });

  test("the packing list API returns unfulfilled orders, oldest first", async () => {
    const base = await start();
    const list = (await (await fetch(`${base}/api/packing-list`, as("packer@example.com"))).json()) as Array<{ name: string }>;
    expect(list.map((entry) => entry.name)).toEqual(["#1001", "#1002", "#1004"]);
  });

  test("the stock API is owner only", async () => {
    const base = await start();
    expect((await fetch(`${base}/api/stock`, as("packer@example.com"))).status).toBe(403);
    const ownerRes = await fetch(`${base}/api/stock`, as("owner@example.com"));
    expect(ownerRes.status).toBe(200);
    const body = (await ownerRes.json()) as { lowStock: Array<{ sku: string }> };
    expect(body.lowStock.map((item) => item.sku)).toEqual(["MOON-MAD", "BAR-FUC", "MOON-COF"]);
  });

  test("unknown paths are 404", async () => {
    const base = await start();
    expect((await fetch(`${base}/admin`, as("owner@example.com"))).status).toBe(404);
  });
});

describe("failures", () => {
  const broken: DataSource = {
    getOrders: () => Promise.reject(new Error("secret internal detail")),
    getStock: () => Promise.reject(new Error("secret internal detail")),
  };

  test("a data source failure shows a friendly 502 and hides the internal error", async () => {
    const base = await start(broken);
    const res = await fetch(`${base}/`, as("owner@example.com"));
    expect(res.status).toBe(502);
    const html = await res.text();
    expect(html).toContain("Could not load orders");
    expect(html).not.toContain("secret internal detail");
  });

  test("API failures return JSON", async () => {
    const base = await start(broken);
    const res = await fetch(`${base}/api/packing-list`, as("packer@example.com"));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Could not load data from the shop." });
  });
});

describe("output is escaped", () => {
  test("a product title containing HTML is shown as text, not run", async () => {
    const base = await start({
      getOrders: async () => [
        {
          id: "x",
          name: "#9",
          createdAt: "2026-11-20T10:00:00Z",
          country: "GB",
          shippingMethod: "Tracked",
          fulfilled: false,
          items: [{ title: "<script>alert(1)</script>", sku: "X", quantity: 1 }],
        },
      ],
      getStock: async () => [],
    });
    const html = await (await fetch(`${base}/`, as("packer@example.com"))).text();
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});
