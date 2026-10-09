import { NextRequest, NextResponse } from "next/server";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, isSupportedLocale, type SupportedLocale } from "@/lib/locales";
import { appSurface, isAdminHost, isAdminPage } from "@/lib/admin/surface";
import { authMode } from "@/lib/admin/auth/config";
import { syncAdminSession } from "@/lib/admin/auth/proxy-session";
import { adminHeaders } from "@/lib/admin/headers";

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

// ---------------------------------------------------------------------------
// Admin application (APP_SURFACE=admin): a separate deployment that serves
// only the private admin pages, only on its configured hosts. Every admin
// page and action still checks the signed-in team member itself.

const ADMIN_HEADERS = adminHeaders(process.env.NODE_ENV === "production");

function withAdminHeaders(response: NextResponse) {
  for (const [key, value] of Object.entries(ADMIN_HEADERS)) response.headers.set(key, value);
  return response;
}

const notFound = () => withAdminHeaders(new NextResponse("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } }));

async function adminProxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Answer only on the admin hosts; anything else (another domain pointed at
  // this deployment, a stale alias) gets nothing.
  if (!isAdminHost(request.headers.get("host"))) return notFound();
  if (pathname.startsWith("/_next/") || /^\/(favicon\.ico|icon\.svg|apple-icon\.png)$/.test(pathname)) return NextResponse.next();
  if (pathname === "/robots.txt") return withAdminHeaders(new NextResponse("User-agent: *\nDisallow: /\n", { headers: { "Content-Type": "text/plain" } }));
  if (pathname === "/") return withAdminHeaders(NextResponse.redirect(new URL("/dashboard", request.url)));
  // Public pages, API routes and anything else are not part of the admin application.
  if (!isAdminPage(pathname)) return notFound();

  if (authMode() === "supabase") return withAdminHeaders(await syncAdminSession(request));
  return withAdminHeaders(NextResponse.next());
}

export async function proxy(request: NextRequest) {
  if (appSurface() === "admin") return adminProxy(request);

  const { pathname, search } = request.nextUrl;

  // Never touch: Next internals, the hidden internal tool, API routes, SEO
  // files, or any request for a file (has an extension) such as favicon.ico/icon.svg.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/internal") ||
    pathname.startsWith("/api") ||
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
