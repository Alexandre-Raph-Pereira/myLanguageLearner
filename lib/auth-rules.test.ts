import { describe, expect, it } from "vitest";
import { isEmailAllowed, isPublicPath, safeNextPath } from "./auth-rules";

describe("isPublicPath", () => {
  it.each([
    "/login",
    "/auth/callback",
    "/manifest.webmanifest",
    "/icons/icon-192.png",
    "/_next/static/x.js",
  ])("%s is public", (p) => expect(isPublicPath(p)).toBe(true));
  it.each(["/", "/settings", "/tests", "/loginx", "/api/x"])("%s is protected", (p) =>
    expect(isPublicPath(p)).toBe(false),
  );
});

describe("isEmailAllowed", () => {
  it("is case-insensitive and rejects empty", () => {
    expect(isEmailAllowed("Me@X.com", ["me@x.com"])).toBe(true);
    expect(isEmailAllowed("other@x.com", ["me@x.com"])).toBe(false);
    expect(isEmailAllowed(undefined, ["me@x.com"])).toBe(false);
    expect(isEmailAllowed("me@x.com", [])).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("rejects external redirects", () => {
    expect(safeNextPath("/settings")).toBe("/settings");
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
});
