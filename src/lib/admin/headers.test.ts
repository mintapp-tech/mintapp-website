import { describe, expect, test } from "vitest";
import { adminCsp, adminHeaders } from "./headers";

describe("admin response headers", () => {
  test("production: HTTPS only, private, never cached, never framed, never indexed", () => {
    const h = adminHeaders(true);
    expect(h["Strict-Transport-Security"]).toBe("max-age=31536000; includeSubDomains");
    expect(h["Cache-Control"]).toBe("private, no-store");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["X-Robots-Tag"]).toBe("noindex, nofollow");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Referrer-Policy"]).toBe("same-origin");
    expect(h["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(h["Cross-Origin-Resource-Policy"]).toBe("same-origin");
    for (const feature of ["camera", "microphone", "geolocation", "payment", "usb"]) expect(h["Permissions-Policy"]).toContain(`${feature}=()`);
  });
  test("development does not tell the browser to insist on HTTPS", () => {
    expect(adminHeaders(false)["Strict-Transport-Security"]).toBeUndefined();
  });
  test("the content security policy allows this origin only, in production without eval or websockets", () => {
    const csp = adminCsp(true);
    for (const directive of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'", "img-src 'self' data:"]) expect(csp).toContain(directive);
    expect(csp).not.toMatch(/unsafe-eval|ws:|https?:\/\/|\*/);
    expect(adminCsp(false)).toContain("'unsafe-eval'");
  });
});
