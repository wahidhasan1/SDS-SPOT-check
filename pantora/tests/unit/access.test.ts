import { describe, expect, it } from "vitest";
import { isOpenPath, safeNextPath } from "@/lib/access";
import { accessToken, codeMatches, hasAccess, recordFailure, tooManyAttempts } from "@/server/access";

describe("private access gate", () => {
  it("only leaves the code form, health check, and static assets open", () => {
    for (const p of ["/access", "/api/access", "/api/health", "/_next/static/x.js", "/icon.svg"]) expect(isOpenPath(p)).toBe(true);
    for (const p of ["/", "/dashboard", "/api/battles", "/admin", "/accessible"]) expect(isOpenPath(p)).toBe(false);
  });

  it("accepts only same-site destinations after entering the code", () => {
    expect(safeNextPath("/dashboard?x=1")).toBe("/dashboard?x=1");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("/access?next=/x")).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
  });

  it("checks codes and cookies without storing the code", () => {
    expect(codeMatches(" open-sesame ", "open-sesame")).toBe(true);
    expect(codeMatches("wrong", "open-sesame")).toBe(false);
    const token = accessToken("open-sesame");
    expect(token).not.toContain("open-sesame");
    expect(hasAccess(token, "open-sesame")).toBe(true);
    expect(hasAccess(token, "new-code")).toBe(false);
    expect(hasAccess(undefined, "open-sesame")).toBe(false);
  });

  it("limits repeated wrong guesses", () => {
    const now = 1_000_000;
    for (let i = 0; i < 10; i++) recordFailure("1.2.3.4", now);
    expect(tooManyAttempts("1.2.3.4", now + 1000)).toBe(true);
    expect(tooManyAttempts("1.2.3.4", now + 16 * 60 * 1000)).toBe(false);
    expect(tooManyAttempts("5.6.7.8", now)).toBe(false);
  });
});
