import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NazarihCaseStudy from "@/components/case-study/NazarihCaseStudy";
import { resolveLocale } from "@/lib/locales";
import { buildPageMetadata } from "@/lib/seo";

const COPY = {
  en: {
    title: "Nazarih — Case Study — Mintapp",
    description:
      "How Mintapp built Nazarih: a multi-category classifieds marketplace spanning real estate, vehicles, hardware and everyday goods.",
  },
  ar: {
    title: "Nazarih — دراسة حالة — Mintapp",
    description:
      "كيف بنت Mintapp Nazarih: سوق إعلانات مبوّبة متعدد الفئات يشمل العقارات والمركبات والأدوات والسلع اليومية.",
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  return buildPageMetadata({ locale, path: "/work/nazarih", ...COPY[locale] });
}

export default function NazarihCaseStudyPage() {
  return (
    <>
      <Header />
      <main>
        <NazarihCaseStudy />
      </main>
      <Footer />
    </>
  );
}
