import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { parseRoles } from "./identity.js";
import { createApp } from "./server.js";
import { SampleSource, ShopifySource } from "./sources.js";
import type { DataSource } from "./types.js";

// The app only ever listens on the loopback address. Tailscale Serve, running on the same machine,
// is the only way in, which is what makes its identity headers trustworthy.
const HOST = "127.0.0.1";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. See .env.example.`);
    process.exit(1);
  }
  return value;
}

function loadRoles(file: string) {
  try {
    return parseRoles(JSON.parse(readFileSync(file, "utf8")));
  } catch (error) {
    console.error(`Could not read roles from ${file}: ${error instanceof Error ? error.message : String(error)}`);
    console.error("Copy roles.example.json to roles.json and add the Tailscale logins you want to allow.");
    process.exit(1);
  }
}

function loadSource(): DataSource {
  const kind = process.env.DATA_SOURCE ?? "sample";
  if (kind === "sample") return new SampleSource();
  if (kind === "shopify") {
    return new ShopifySource({
      store: required("SHOPIFY_STORE"),
      accessToken: required("SHOPIFY_ACCESS_TOKEN"),
      apiVersion: process.env.SHOPIFY_API_VERSION ?? "2025-07",
    });
  }
  console.error(`DATA_SOURCE must be "sample" or "shopify", not "${kind}".`);
  process.exit(1);
}

const port = Number(process.env.PORT ?? 3000);
const threshold = Number(process.env.LOW_STOCK_THRESHOLD ?? 2);
const roles = loadRoles(process.env.ROLES_FILE ?? "roles.json");
const source = loadSource();

const handle = createApp({
  source,
  roles,
  lowStockThreshold: Number.isFinite(threshold) ? threshold : 2,
  log: (line) => console.log(new Date().toISOString(), line),
});

createServer((req, res) => {
  handle(req, res).catch((error) => {
    console.error(error);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  });
}).listen(port, HOST, () => {
  console.log(`Dashboard listening on http://${HOST}:${port} (data: ${process.env.DATA_SOURCE ?? "sample"})`);
  console.log(`Share it on your tailnet with: tailscale serve --bg ${port}`);
});
