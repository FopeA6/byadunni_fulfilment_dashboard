import type { IncomingMessage, ServerResponse } from "node:http";
import { lowStock, packingList, summarise } from "./fulfilment.js";
import { readIdentity, resolveRole } from "./identity.js";
import type { DataSource, Identity, Role, RolesConfig } from "./types.js";
import { dashboardPage, messagePage } from "./views.js";

export type AppOptions = {
  source: DataSource;
  roles: RolesConfig;
  lowStockThreshold: number;
  now?: () => Date;
  log?: (line: string) => void;
};

function send(res: ServerResponse, status: number, contentType: string, body: string): void {
  res.writeHead(status, {
    "Content-Type": `${contentType}; charset=utf-8`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  send(res, status, "application/json", JSON.stringify(value));
}

/** Builds the request handler. Kept separate from listening so tests can drive it directly. */
export function createApp(options: AppOptions) {
  const now = options.now ?? (() => new Date());
  const log = options.log ?? (() => {});

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;

    if (req.method !== "GET") {
      send(res, 405, "text/plain", "Only GET is supported.");
      return;
    }

    if (path === "/healthz") {
      send(res, 200, "text/plain", "ok");
      return;
    }

    const identity: Identity | null = readIdentity(req.headers);
    if (!identity) {
      send(
        res,
        401,
        "text/html",
        messagePage("Open this through Tailscale", "This dashboard is only available to people on the shop's tailnet."),
      );
      return;
    }

    const role: Role | null = resolveRole(identity.login, options.roles);
    if (!role) {
      log(`denied ${identity.login} ${path}`);
      send(res, 403, "text/html", messagePage("No access", `${identity.login} is not on the list for this dashboard.`));
      return;
    }

    try {
      if (path === "/") {
        const orders = await options.source.getOrders();
        const packing = packingList(orders, now());
        if (role === "owner") {
          const stock = await options.source.getStock();
          send(
            res,
            200,
            "text/html",
            dashboardPage({
              identity,
              role,
              packing,
              summary: summarise(orders, stock, now(), options.lowStockThreshold),
              stock: lowStock(stock, options.lowStockThreshold),
              threshold: options.lowStockThreshold,
            }),
          );
        } else {
          send(res, 200, "text/html", dashboardPage({ identity, role, packing, threshold: options.lowStockThreshold }));
        }
        return;
      }

      if (path === "/api/packing-list") {
        const orders = await options.source.getOrders();
        sendJson(res, 200, packingList(orders, now()));
        return;
      }

      if (path === "/api/stock") {
        if (role !== "owner") {
          sendJson(res, 403, { error: "Stock is only available to owners." });
          return;
        }
        const stock = await options.source.getStock();
        sendJson(res, 200, {
          lowStock: lowStock(stock, options.lowStockThreshold),
          all: stock,
        });
        return;
      }

      send(res, 404, "text/plain", "Not found.");
    } catch (error) {
      log(`data source error: ${error instanceof Error ? error.message : String(error)}`);
      if (path.startsWith("/api/")) {
        sendJson(res, 502, { error: "Could not load data from the shop." });
      } else {
        send(res, 502, "text/html", messagePage("Could not load orders", "The shop's data could not be loaded. Try again in a minute."));
      }
    }
  };
}
