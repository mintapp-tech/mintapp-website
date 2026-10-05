import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Alexandria, Manrope } from "next/font/google";
import { adminLocale } from "@/lib/admin/locale";
import { directionOf } from "@/lib/admin/messages";
import "../globals.css";

const alexandria = Alexandria({ variable: "--font-alexandria-google", subsets: ["arabic", "latin"], weight: ["400", "500", "600", "700"] });
const manrope = Manrope({ variable: "--font-manrope-google", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

// Only each font's primary family: their metric fallbacks are local Arial,
// which covers Arabic and would win over Alexandria for Arabic text.
const primary = (font: { style: { fontFamily: string } }) => font.style.fontFamily.split(",")[0];

export const metadata: Metadata = {
  title: { default: "Mintapp admin", template: "%s · Mintapp admin" },
  robots: { index: false, follow: false, nocache: true },
};

// Root layout of the private admin application (APP_SURFACE=admin builds only).
export default async function AdminRootLayout({ children }: { children: ReactNode }) {
  const locale = await adminLocale();
  // English interface: Manrope, Arabic content in Alexandria. Arabic
  // interface: Alexandria throughout, as on the public Arabic site.
  const stack = locale === "ar" ? [primary(alexandria), primary(manrope)] : [primary(manrope), primary(alexandria)];
  return (
    <html
      lang={locale}
      dir={directionOf(locale)}
      className={`${alexandria.variable} ${manrope.variable} h-full antialiased`}
      style={{ "--font-team": `${stack.join(", ")}, system-ui, sans-serif` } as React.CSSProperties}
    >
      <body className="min-h-full bg-canvas text-ink" style={{ fontFamily: "var(--font-team)" }}>
        {children}
      </body>
    </html>
  );
}
