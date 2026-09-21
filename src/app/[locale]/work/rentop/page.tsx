import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RentopCaseStudy from "@/components/case-study/RentopCaseStudy";
import { resolveLocale } from "@/lib/locales";
import { buildPageMetadata } from "@/lib/seo";

const COPY = {
  en: {
    title: "Rentop — Case Study — Mintapp",
    description:
      "How Mintapp built Rentop: a consumer car rental app for browsing by brand and category and booking directly, built for the UAE market.",
  },
  ar: {
    title: "Rentop — دراسة حالة — Mintapp",
    description:
      "كيف بنت Mintapp Rentop: تطبيق تأجير سيارات للمستهلك للتصفّح حسب الماركة والفئة والحجز مباشرة، مصمم لسوق الإمارات.",
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  return buildPageMetadata({ locale, path: "/work/rentop", ...COPY[locale] });
}

export default function RentopCaseStudyPage() {
  return (
    <>
      <Header />
      <main>
        <RentopCaseStudy />
      </main>
      <Footer />
    </>
  );
}
