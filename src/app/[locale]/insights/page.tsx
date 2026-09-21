import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import InsightsPageContent from "@/components/insights/InsightsPageContent";
import { resolveLocale } from "@/lib/locales";
import { buildPageMetadata } from "@/lib/seo";

const COPY = {
  en: {
    title: "Insights — Mintapp",
    description:
      "Short writing on building digital products in Egypt and the wider MENA region — product strategy, UX/UI design, and web and mobile development.",
  },
  ar: {
    title: "مقالات — Mintapp",
    description:
      "كتابات موجزة عن بناء المنتجات الرقمية في مصر والمنطقة العربية — استراتيجية المنتج، تصميم التجربة والواجهة، وتطوير الويب والموبايل.",
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  return buildPageMetadata({ locale, path: "/insights", ...COPY[locale] });
}

export default function InsightsPage() {
  return (
    <>
      <Header />
      <main>
        <InsightsPageContent />
      </main>
      <Footer />
    </>
  );
}
