import type { Metadata } from "next";
import { Alexandria, Manrope } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/language-context";
import SmoothScroll from "@/components/SmoothScroll";
import CustomCursor from "@/components/CustomCursor";

const alexandria = Alexandria({
  variable: "--font-alexandria-google",
  subsets: ["arabic", "latin"],
  weight: ["200", "300", "400", "500", "600", "700"],
});

const manrope = Manrope({
  variable: "--font-manrope-google",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Mintapp — Software that feels easy",
  description:
    "Mintapp is a digital product studio helping startups and growing businesses across Egypt and the MENA region turn ideas into thoughtful, launch-ready websites and mobile apps.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${alexandria.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-canvas text-ink">
        <LanguageProvider>
          <SmoothScroll>{children}</SmoothScroll>
          <CustomCursor />
        </LanguageProvider>
      </body>
    </html>
  );
}
