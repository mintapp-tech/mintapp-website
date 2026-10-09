import { describe, expect, test } from "vitest";
import { EXISTING_LINK_MAX, normalizeExistingLink } from "./existing-link";

describe("existing website or app link", () => {
  test("a public http(s) address is accepted, with or without a scheme, without its fragment", () => {
    expect(normalizeExistingLink("example.com")).toBe("https://example.com/");
    expect(normalizeExistingLink("  https://www.Acme.example.co/shop?x=1#top ")).toBe("https://www.acme.example.co/shop?x=1");
    expect(normalizeExistingLink("http://acme.example.org")).toBe("http://acme.example.org/");
    expect(normalizeExistingLink("https://acme.example.org:443/a")).toBe("https://acme.example.org/a");
  });
  test("other schemes, credentials, IPs, local or single-word hosts, odd ports and junk are refused", () => {
    for (const bad of [
      "javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html;base64,AAAA", "file:///etc/passwd", "ftp://example.com", "mailto:a@example.com",
      "https://user@example.com", "https://user:pw@example.com", "http://127.0.0.1", "https://[::1]/", "http://10.0.0.5:8080", "https://localhost",
      "https://intranet", "https://app.local", "https://example.com:8443", "https://exa mple.com", "https://example.com/<script>", "", "   ", null, undefined,
      `https://example.com/${"a".repeat(EXISTING_LINK_MAX)}`,
    ]) {
      expect(normalizeExistingLink(bad as string), String(bad)).toBeNull();
    }
  });
  test("the result never exceeds the limit", () => {
    const link = `https://example.com/${"a".repeat(EXISTING_LINK_MAX - 25)}`;
    expect(normalizeExistingLink(link)!.length).toBeLessThanOrEqual(EXISTING_LINK_MAX);
  });
});
