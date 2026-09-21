import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import JameelCaseStudy from "@/components/case-study/JameelCaseStudy";
import { resolveLocale } from "@/lib/locales";
import { buildPageMetadata } from "@/lib/seo";

const COPY = {
  en: {
    title: "Jameel — Case Study — Mintapp",
    description:
      "How Mintapp built Jameel: a four-sided car wash service marketplace with customer, provider and worker apps plus an admin dashboard.",
  },
  ar: {
    title: "Jameel — دراسة حالة — Mintapp",
    description:
      "كيف بنت Mintapp Jameel: سوق خدمات غسيل سيارات رباعي الأطراف بتطبيقات للعميل والمزوّد والعامل ولوحة تحكم إدارية.",
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  return buildPageMetadata({ locale, path: "/work/jameel", ...COPY[locale] });
}

export default function JameelCaseStudyPage() {
  return (
    <>
      <Header />
      <main>
        <JameelCaseStudy />
      </main>
      <Footer />
    </>
  );
}
