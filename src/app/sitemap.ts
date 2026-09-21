import type { MetadataRoute } from "next";
import { SUPPORTED_LOCALES } from "@/lib/locales";
import { SITE_URL, PUBLIC_ROUTE_PATHS } from "@/lib/seo";

// Exactly the 13 real public paths × 2 supported locales = 26 absolute
// production URLs. No lastModified/changeFrequency/priority — this repo
// has no reliable per-page content-date source, and fabricating one would
// misrepresent freshness to crawlers. The origin is the fixed production
// constant, never derived from a request host header.
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTE_PATHS.flatMap((path) =>
    SUPPORTED_LOCALES.map((locale) => ({
      url: `${SITE_URL}/${locale}${path}`,
    })),
  );
}
