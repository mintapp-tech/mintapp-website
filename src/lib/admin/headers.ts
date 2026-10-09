// Response headers for every response of the private admin application.

// Content Security Policy: everything from this origin only (fonts are
// self-hosted by next/font; the authenticator QR is a data: image). Inline
// scripts are allowed because Next.js bootstraps with them; no external
// script, connection, frame, object or form target is.
export function adminCsp(production: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self'${production ? "" : " ws:"}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function adminHeaders(production: boolean): Record<string, string> {
  return {
    "X-Robots-Tag": "noindex, nofollow",
    "Cache-Control": "private, no-store",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": adminCsp(production),
    "Referrer-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    // HTTPS only, for a year, on this host and its subdomains. Not sent in local
    // development, where the site is plain HTTP and the browser would remember it.
    ...(production ? { "Strict-Transport-Security": "max-age=31536000; includeSubDomains" } : {}),
  };
}
