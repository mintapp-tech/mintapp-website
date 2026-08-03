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

export default function InternalRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${alexandria.variable} ${manrope.variable} h-full antialiased`}>
      <body className="min-h-full bg-canvas text-ink">{children}</body>
    </html>
  );
}
