import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ArrentioCaseStudy from "@/components/case-study/ArrentioCaseStudy";
import { resolveLocale } from "@/lib/locales";
import { buildPageMetadata } from "@/lib/seo";

const COPY = {
  en: {
    title: "Arrentio — Case Study — Mintapp",
    description:
      "How Mintapp built Arrentio: a verified car rental marketplace and agency platform with multi-tenant storefronts, designed for Indonesia and the Gulf.",
  },
  ar: {
    title: "Arrentio — دراسة حالة — Mintapp",
    description:
      "كيف بنت Mintapp Arrentio: سوق موثوق لتأجير السيارات ومنصة تشغيل للوكالات بمتاجر متعددة النطاقات، مصممة لإندونيسيا والخليج.",
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  return buildPageMetadata({ locale, path: "/work/arrentio", ...COPY[locale] });
}

export default function ArrentioCaseStudyPage() {
  return (
    <>
      <Header />
      <main>
        <ArrentioCaseStudy />
      </main>
      <Footer />
    </>
  );
}
