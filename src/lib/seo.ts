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

// The one sitewide default social-preview image. No page-specific images
// yet — every page shares this, so every og:image/twitter:image reference
// stays correct by construction. Built as a fully absolute URL directly
// (not left relative for metadataBase to resolve) so the nested
// openGraph.images/twitter.images array is unambiguous regardless of any
// metadataBase resolution nuance for nested object fields.
const OG_IMAGE_PATH = "/og/mintapp-default.png";
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;
const OG_IMAGE_ALT = "Mintapp — Software that feels easy";
const OG_IMAGE_URL = `${SITE_URL}${OG_IMAGE_PATH}`;

const SITE_NAME = "Mintapp";

// Real, specific locale tags — not a generic "ar" — matching this project's
// established Egypt/MENA focus already stated elsewhere in the site's own
// content (see privacy.regionCopy and the about page). Not a claim placed
// on any visible content; purely a structured Open Graph locale signal.
const OG_LOCALE: Record<SupportedLocale, string> = {
  en: "en_US",
  ar: "ar_EG",
};

function alternateLocaleFor(locale: SupportedLocale): string {
  return locale === "en" ? OG_LOCALE.ar : OG_LOCALE.en;
}

// Every page's generateMetadata funnels through this one function so
// canonical construction and the reciprocal en/ar alternate pair can never
// drift out of sync between routes. Deliberately no x-default: the site's
// locale-negotiation behavior (cookie, then Accept-Language, then a
// default) is visitor-dependent, not a fixed "canonical language," so an
// x-default target isn't asserted here.
export function buildPageMetadata({ locale, path, title, description }: PageSeoInput): Metadata {
  const canonicalPath = `/${locale}${path}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath,
      languages: {
        en: `/en${path}`,
        ar: `/ar${path}`,
      },
    },
    openGraph: {
      type: "website",
      title,
      description,
      // Relative — resolved to an absolute URL against the root layout's
      // metadataBase, the same mechanism already proven for
      // alternates.canonical.
      url: canonicalPath,
      siteName: SITE_NAME,
      locale: OG_LOCALE[locale],
      alternateLocale: alternateLocaleFor(locale),
      images: [
        {
          url: OG_IMAGE_URL,
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          alt: OG_IMAGE_ALT,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [
        {
          url: OG_IMAGE_URL,
          alt: OG_IMAGE_ALT,
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
        },
      ],
    },
  };
}
