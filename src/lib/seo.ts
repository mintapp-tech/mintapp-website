import type { Metadata } from "next";
import type { SupportedLocale } from "./locales";

// The canonical production origin — matches the same hostname already
// trusted elsewhere (see turnstile-config.ts's allowed-hostnames list).
// Used only as metadataBase; every URL-bearing metadata field below stays
// a relative path so it resolves against this base, per Next.js's
// documented metadataBase behavior.
export const SITE_URL = "https://www.mintapp.tech";

// The single source of truth for every real public page's path, shared by
// the sitemap generator and (mirrored in) the Milestone 1/2 test suites.
// Each entry is a path with a leading slash, or "" for the locale root.
// Deliberately excludes "/work" (no Work index route exists) and
// "/internal/concept-pack" (private, noindex, not locale-routed).
export const PUBLIC_ROUTE_PATHS: readonly string[] = [
  "",
  "/about",
  "/services",
  "/insights",
  "/start",
  "/privacy",
  "/work/arrentio",
  "/work/jameel",
  "/work/kwayes",
  "/work/nazarih",
  "/work/rentop",
  "/work/tanglevibe",
  "/work/taskaty",
];

interface PageSeoInput {
  locale: SupportedLocale;
  /** Path with a leading slash, or "" for the locale root (e.g. "/about", "/work/jameel"). */
  path: string;
  title: string;
  description: string;
}

// Every page's generateMetadata funnels through this one function so
// canonical construction and the reciprocal en/ar alternate pair can never
// drift out of sync between routes. Deliberately no x-default: the site's
// locale-negotiation behavior (cookie, then Accept-Language, then a
// default) is visitor-dependent, not a fixed "canonical language," so an
// x-default target isn't asserted here.
export function buildPageMetadata({ locale, path, title, description }: PageSeoInput): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}${path}`,
      languages: {
        en: `/en${path}`,
        ar: `/ar${path}`,
      },
    },
  };
}
