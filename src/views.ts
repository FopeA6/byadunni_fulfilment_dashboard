import type { PackingEntry, StockAlert, Summary } from "./fulfilment.js";
import type { Identity, Role } from "./types.js";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const STYLE = `
  :root { --ink:#2b2320; --muted:#6f645e; --line:#e4dcd3; --bg:#faf7f2; --card:#ffffff; --warn:#a33a1f; }
  @media (prefers-color-scheme: dark) {
    :root { --ink:#f1ebe4; --muted:#b5aaa2; --line:#3a332f; --bg:#1d1916; --card:#26211d; --warn:#f08a6c; }
  }
  * { box-sizing: border-box; }
  body { margin:0; padding:16px; font:16px/1.5 system-ui, sans-serif; color:var(--ink); background:var(--bg); }
  main { max-width:760px; margin:0 auto; }
  h1 { font-size:1.5rem; margin:0 0 4px; }
  h2 { font-size:1.15rem; margin:28px 0 8px; }
  .who { color:var(--muted); margin:0 0 20px; }
  .tiles { display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:8px; }
  .tile { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:12px; }
  .tile b { display:block; font-size:1.5rem; }
  .order { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:12px; margin-bottom:8px; }
  .order header { display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap; font-weight:600; }
  .meta { color:var(--muted); font-size:.9rem; }
  ul { margin:8px 0 0; padding-left:20px; }
  table { width:100%; border-collapse:collapse; background:var(--card); }
  th, td { text-align:left; padding:8px; border-bottom:1px solid var(--line); }
  .soldout { color:var(--warn); font-weight:600; }
  .empty { color:var(--muted); }
`;

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${STYLE}</style>
</head>
<body><main>${body}</main></body>
</html>`;
}

function ageLabel(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function packingSection(entries: PackingEntry[]): string {
  if (entries.length === 0) {
    return `<h2>To pack</h2><p class="empty">Nothing to pack. All orders are fulfilled.</p>`;
  }
  const cards = entries
    .map(
      (entry) => `
    <article class="order" data-testid="order">
      <header><span>${escapeHtml(entry.name)}</span><span class="meta">${ageLabel(entry.ageDays)}</span></header>
      <div class="meta">${escapeHtml(entry.country || "Country unknown")} · ${escapeHtml(entry.shippingMethod || "Shipping method unknown")}</div>
      <ul>${entry.items
        .map((item) => `<li>${item.quantity} × ${escapeHtml(item.title)} <span class="meta">${escapeHtml(item.sku)}</span></li>`)
        .join("")}</ul>
    </article>`,
    )
    .join("");
  return `<h2>To pack (oldest first)</h2>${cards}`;
}

function stockSection(alerts: StockAlert[], threshold: number): string {
  if (alerts.length === 0) {
    return `<h2>Low stock</h2><p class="empty">Nothing at or below ${threshold}.</p>`;
  }
  const rows = alerts
    .map(
      (alert) => `<tr><td>${escapeHtml(alert.title)}</td><td>${escapeHtml(alert.sku)}</td><td${alert.soldOut ? ' class="soldout"' : ""}>${
        alert.soldOut ? "Sold out" : alert.quantity
      }</td></tr>`,
    )
    .join("");
  return `<h2>Low stock (${threshold} or fewer)</h2>
<table><thead><tr><th>Item</th><th>SKU</th><th>In stock</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function summaryTiles(summary: Summary): string {
  const tile = (label: string, value: string) => `<div class="tile"><b>${escapeHtml(value)}</b>${escapeHtml(label)}</div>`;
  return `<div class="tiles">
    ${tile("orders to pack", String(summary.ordersToPack))}
    ${tile("items to pack", String(summary.itemsToPack))}
    ${tile("oldest order", summary.oldestAgeDays === null ? "none" : ageLabel(summary.oldestAgeDays))}
    ${tile("sold out", String(summary.soldOutCount))}
  </div>`;
}

export function dashboardPage(args: {
  identity: Identity;
  role: Role;
  packing: PackingEntry[];
  summary?: Summary;
  stock?: StockAlert[];
  threshold: number;
}): string {
  const roleLabel = args.role === "owner" ? "owner view" : "fulfilment view";
  let body = `<h1>Orders</h1><p class="who">Signed in through Tailscale as ${escapeHtml(args.identity.name)} · ${roleLabel}</p>`;
  if (args.role === "owner" && args.summary) {
    body += summaryTiles(args.summary);
  }
  body += packingSection(args.packing);
  if (args.role === "owner" && args.stock) {
    body += stockSection(args.stock, args.threshold);
  }
  return page("Orders", body);
}

export function messagePage(title: string, message: string): string {
  return page(title, `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>`);
}
