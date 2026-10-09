import { describe, expect, test } from "vitest";
import { isSameOrigin } from "./csrf";

const h = (o: Record<string, string>) => new Headers(o);

describe("same-origin check for non-action routes", () => {
  test("accepts a form posted from the same host", () => {
    expect(isSameOrigin(h({ origin: "https://admin.example.invalid", host: "admin.example.invalid", "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(isSameOrigin(h({ origin: "http://localhost:3201", host: "localhost:3201" }))).toBe(true);
  });
  test("refuses a missing origin, another site, another host, or a cross-site fetch", () => {
    expect(isSameOrigin(h({ host: "admin.example.invalid" }))).toBe(false);
    expect(isSameOrigin(h({ origin: "https://evil.invalid", host: "admin.example.invalid" }))).toBe(false);
    expect(isSameOrigin(h({ origin: "https://admin.example.invalid.evil.invalid", host: "admin.example.invalid" }))).toBe(false);
    expect(isSameOrigin(h({ origin: "https://admin.example.invalid", host: "admin.example.invalid", "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isSameOrigin(h({ origin: "https://admin.example.invalid", host: "admin.example.invalid", "sec-fetch-site": "same-site" }))).toBe(false);
    expect(isSameOrigin(h({ origin: "null", host: "admin.example.invalid" }))).toBe(false);
    expect(isSameOrigin(h({ origin: "not a url", host: "admin.example.invalid" }))).toBe(false);
  });
  test("a forwarded host counts, but only the first one", () => {
    expect(isSameOrigin(h({ origin: "https://admin.example.invalid", host: "internal", "x-forwarded-host": "admin.example.invalid, other.invalid" }))).toBe(true);
    expect(isSameOrigin(h({ origin: "https://admin.example.invalid", host: "internal", "x-forwarded-host": "other.invalid, admin.example.invalid" }))).toBe(false);
  });
});
