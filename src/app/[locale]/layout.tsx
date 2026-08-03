import type { Metadata } from "next";
import { Alexandria, Manrope } from "next/font/google";
import "../globals.css";
import { LanguageProvider } from "@/lib/language-context";
import SmoothScroll from "@/components/SmoothScroll";
import CustomCursor from "@/components/CustomCursor";
import { SUPPORTED_LOCALES, resolveLocale } from "@/lib/locales";

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
  const locale = resolveLocale(rawLocale);
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} className={`${alexandria.variable} ${manrope.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-canvas text-ink">
        <LanguageProvider locale={locale}>
          <SmoothScroll>{children}</SmoothScroll>
          <CustomCursor />
        </LanguageProvider>
      </body>
    </html>
  );
}
