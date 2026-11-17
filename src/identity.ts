import type { IncomingHttpHeaders } from "node:http";
import type { Identity, Role, RolesConfig } from "./types.js";

/**
 * Tailscale Serve adds these headers when it forwards a request from a person on your tailnet.
 * Node lower-cases header names, so they are read in lower case here.
 *
 * These headers are only trustworthy because the app listens on 127.0.0.1, so the only way in is
 * through Tailscale Serve on the same machine. If the app were reachable directly, anyone could
 * send these headers themselves.
 */
const LOGIN_HEADER = "tailscale-user-login";
const NAME_HEADER = "tailscale-user-name";

function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/** Returns who is asking, or null if the request did not come through Tailscale Serve. */
export function readIdentity(headers: IncomingHttpHeaders): Identity | null {
  const login = firstValue(headers[LOGIN_HEADER]).trim();
  if (login === "") return null;
  const name = firstValue(headers[NAME_HEADER]).trim();
  return { login, name: name === "" ? login : name };
}

/** Maps a login to a role. Owner wins if someone is listed under both. Matching ignores case. */
export function resolveRole(login: string, roles: RolesConfig): Role | null {
  const wanted = login.trim().toLowerCase();
  const listed = (logins: string[]) => logins.some((entry) => entry.trim().toLowerCase() === wanted);
  if (listed(roles.owner)) return "owner";
  if (listed(roles.fulfilment)) return "fulfilment";
  return null;
}

/** Checks a parsed roles file and returns it in a known shape, or throws with a readable message. */
export function parseRoles(raw: unknown): RolesConfig {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Roles file must be a JSON object with \"owner\" and \"fulfilment\" lists.");
  }
  const record = raw as Record<string, unknown>;
  const list = (key: string): string[] => {
    const value = record[key] ?? [];
    if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
      throw new Error(`"${key}" in the roles file must be a list of login names.`);
    }
    return value;
  };
  const roles = { owner: list("owner"), fulfilment: list("fulfilment") };
  if (roles.owner.length === 0) {
    throw new Error("The roles file needs at least one owner.");
  }
  return roles;
}
