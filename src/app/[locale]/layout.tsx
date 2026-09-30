import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alexandria, Manrope } from "next/font/google";
import "../globals.css";
import { LanguageProvider } from "@/lib/language-context";
import SmoothScroll from "@/components/SmoothScroll";
import CustomCursor from "@/components/CustomCursor";
import { MotionPreferences } from "@/components/motion/MotionPreferences";
import { SUPPORTED_LOCALES, isSupportedLocale } from "@/lib/locales";
import { SITE_URL } from "@/lib/seo";

const alexandria = Alexandria({
  variable: "--font-alexandria-google",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

const manrope = Manrope({
  variable: "--font-manrope-google",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Mintapp — Software that feels easy",
  description:
    "Mintapp is a digital product studio helping startups and growing businesses across Egypt and the MENA region turn ideas into thoughtful, launch-ready websites and mobile apps.",
};

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale: rawLocale } = await params;
  // proxy.ts already redirects any request whose first segment looks like
  // someone else's locale code (or none at all) into a real supported
  // locale before it ever reaches here. This guard exists for the one
  // class of request that legitimately bypasses proxy.ts: a top-level path
  // with a file extension that doesn't correspond to a real static file or
  // special-file convention (e.g. a guessed /manifest.json). Those reach
  // Next's router as a bare single segment, which the [locale] dynamic
  // segment would otherwise happily match — silently rendering the
  // default-locale homepage with a 200 instead of a real 404. Rejecting an
  // unsupported value here, rather than coercing it, is the fix.
  if (!isSupportedLocale(rawLocale)) {
    notFound();
  }
  const dir = rawLocale === "ar" ? "rtl" : "ltr";

  return (
    <html lang={rawLocale} dir={dir} className={`${alexandria.variable} ${manrope.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-canvas text-ink">
        <LanguageProvider locale={rawLocale}>
          <MotionPreferences>
            <SmoothScroll>{children}</SmoothScroll>
            <CustomCursor />
          </MotionPreferences>
        </LanguageProvider>
      </body>
    </html>
  );
}
