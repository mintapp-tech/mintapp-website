import { describe, expect, test } from "vitest";
import { sanitizeHeaderValue } from "./sanitize-header-value";

describe("sanitizeHeaderValue", () => {
  test("passes a normal value through unchanged", () => {
    expect(sanitizeHeaderValue("Jane Doe", 100, "fallback")).toBe("Jane Doe");
  });

  test("strips CRLF that could otherwise inject extra headers", () => {
    expect(sanitizeHeaderValue("Jane\r\nBcc: attacker@example.com", 100, "fallback")).toBe("JaneBcc: attacker@example.com");
  });

  test("strips other control characters", () => {
    expect(sanitizeHeaderValue("Jane\x00\x1F\x7FDoe", 100, "fallback")).toBe("JaneDoe");
  });

  test("trims surrounding whitespace", () => {
    expect(sanitizeHeaderValue("   Jane Doe   ", 100, "fallback")).toBe("Jane Doe");
  });

  test("falls back when the cleaned value is empty", () => {
    expect(sanitizeHeaderValue("\r\n\x00   ", 100, "fallback")).toBe("fallback");
  });

  test("truncates to maxLength", () => {
    expect(sanitizeHeaderValue("A".repeat(50), 10, "fallback")).toBe("A".repeat(10));
  });
});
