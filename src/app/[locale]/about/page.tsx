import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AboutPageContent from "@/components/about/AboutPageContent";
import { resolveLocale } from "@/lib/locales";
import { buildPageMetadata } from "@/lib/seo";

const COPY = {
  en: {
    title: "About — Mintapp",
    description:
      "Mintapp is a digital product studio working with founders and small teams in Egypt and MENA to turn early ideas into launch-ready products.",
  },
  ar: {
    title: "من نحن — Mintapp",
    description:
      "Mintapp استوديو منتجات رقمية يعمل مع المؤسسين والفرق الصغيرة في مصر والمنطقة العربية لتحويل الأفكار المبكرة إلى منتجات جاهزة للإطلاق.",
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  return buildPageMetadata({ locale, path: "/about", ...COPY[locale] });
}

export default function AboutPage() {
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="outline-none">
        <AboutPageContent />
      </main>
      <Footer />
    </>
  );
}
