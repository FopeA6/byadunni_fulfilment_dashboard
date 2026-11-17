import { describe, expect, test } from "vitest";
import { parseRoles, readIdentity, resolveRole } from "../src/identity.js";

const roles = { owner: ["owner@example.com"], fulfilment: ["Packer@Example.com"] };

describe("readIdentity", () => {
  test("reads the login and name Tailscale Serve adds", () => {
    expect(
      readIdentity({ "tailscale-user-login": "owner@example.com", "tailscale-user-name": "Shop Owner" }),
    ).toEqual({ login: "owner@example.com", name: "Shop Owner" });
  });

  test("falls back to the login when there is no name", () => {
    expect(readIdentity({ "tailscale-user-login": "owner@example.com" })).toEqual({
      login: "owner@example.com",
      name: "owner@example.com",
    });
  });

  test("no login header means the request did not come through Tailscale Serve", () => {
    expect(readIdentity({})).toBeNull();
    expect(readIdentity({ "tailscale-user-login": "   " })).toBeNull();
  });
});

describe("resolveRole", () => {
  test("maps logins to roles, ignoring case and spaces", () => {
    expect(resolveRole("owner@example.com", roles)).toBe("owner");
    expect(resolveRole(" packer@example.com ", roles)).toBe("fulfilment");
  });

  test("anyone not listed gets no role", () => {
    expect(resolveRole("stranger@example.com", roles)).toBeNull();
  });

  test("owner wins if someone is listed twice", () => {
    expect(resolveRole("a@example.com", { owner: ["a@example.com"], fulfilment: ["a@example.com"] })).toBe("owner");
  });
});

describe("parseRoles", () => {
  test("accepts a valid file and fills in a missing fulfilment list", () => {
    expect(parseRoles({ owner: ["a@example.com"] })).toEqual({ owner: ["a@example.com"], fulfilment: [] });
  });

  test("rejects files that would lock everyone out or are the wrong shape", () => {
    expect(() => parseRoles({ owner: [] })).toThrow("at least one owner");
    expect(() => parseRoles({ owner: "a@example.com" })).toThrow("list of login names");
    expect(() => parseRoles(null)).toThrow("JSON object");
  });
});
