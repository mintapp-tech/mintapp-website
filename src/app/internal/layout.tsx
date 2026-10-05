import { Alexandria, Manrope } from "next/font/google";
import "../globals.css";

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

// The team dashboard mixes English and Arabic in one view: Latin in Manrope,
// Arabic in Alexandria. Only the primary families are used, because each
// font's metric fallback is a local Arial covering every script, which would
// otherwise render Arabic before Alexandria is reached.
const primary = (font: { style: { fontFamily: string } }) => font.style.fontFamily.split(",")[0];
const teamFont = { "--font-team": `${primary(manrope)}, ${primary(alexandria)}, system-ui, sans-serif` } as React.CSSProperties;

export default function InternalRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${alexandria.variable} ${manrope.variable} h-full antialiased`} style={teamFont}>
      <body className="min-h-full bg-canvas text-ink">{children}</body>
    </html>
  );
}
