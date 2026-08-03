import { NextRequest, NextResponse } from "next/server";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, isSupportedLocale, type SupportedLocale } from "@/lib/locales";

const LOCALE_COOKIE = "mintapp_locale";

// Matches a plausible locale-code shape only: "fr", "de", "en-US", "zh-cn".
// Deliberately narrow (exactly 2 letters, optional 2-letter region subtag) so
// it can never accidentally match a real route segment — none of this site's
// route names are 2 letters long.
const LOCALE_LIKE = /^[a-z]{2}(-[a-z]{2})?$/i;

function resolveTargetLocale(request: NextRequest): SupportedLocale {
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookieLocale && isSupportedLocale(cookieLocale)) return cookieLocale;

  const acceptLanguage = request.headers.get("accept-language")?.toLowerCase() ?? "";
  const fromHeader = SUPPORTED_LOCALES.find((locale) => acceptLanguage.includes(locale));
  if (fromHeader) return fromHeader;

  return DEFAULT_LOCALE;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Never touch: Next internals, the hidden internal tool, SEO files, or any
  // request for a file (has an extension) such as favicon.ico/icon.svg.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/internal") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  const segments = pathname.split("/");
  const firstSegment = segments[1] ?? "";

  if (isSupportedLocale(firstSegment)) {
    // Already locale-prefixed — pass through, just keep the persisted
    // preference cookie in sync so a later bare-URL visit lands here again.
    const response = NextResponse.next();
    response.cookies.set(LOCALE_COOKIE, firstSegment, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return response;
  }

  const targetLocale = resolveTargetLocale(request);

  if (firstSegment && LOCALE_LIKE.test(firstSegment)) {
    // Looks like someone else's locale code (/fr/about, /de/services, ...).
    // Strip it and redirect straight to the equivalent path under a locale we
    // actually support, rather than stacking a valid prefix in front of an
    // invalid one (which previously produced /ar/fr/about).
    const rest = segments.slice(2).join("/");
    const redirectUrl = new URL(`/${targetLocale}${rest ? `/${rest}` : ""}${search}`, request.url);
    return NextResponse.redirect(redirectUrl);
  }

  // Ordinary bare path (e.g. "/", "/about", or a genuinely nonexistent page):
  // prepend the resolved locale so it renders (or cleanly 404s) under it.
  const suffix = pathname === "/" ? "" : pathname;
  const redirectUrl = new URL(`/${targetLocale}${suffix}${search}`, request.url);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
