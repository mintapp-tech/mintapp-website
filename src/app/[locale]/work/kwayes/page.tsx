import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import KwayesCaseStudy from "@/components/case-study/KwayesCaseStudy";
import { resolveLocale } from "@/lib/locales";
import { buildPageMetadata } from "@/lib/seo";

const COPY = {
  en: {
    title: "Kwayes — Case Study — Mintapp",
    description:
      "How Mintapp built Kwayes: a social marketplace for selling secondhand goods with photo and video listings and in-app messaging.",
  },
  ar: {
    title: "Kwayes — دراسة حالة — Mintapp",
    description:
      "كيف بنت Mintapp Kwayes: سوق اجتماعي لبيع الأغراض المستعملة بإعلانات بالصور والفيديو ومراسلات داخل التطبيق.",
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  return buildPageMetadata({ locale, path: "/work/kwayes", ...COPY[locale] });
}

export default function KwayesCaseStudyPage() {
  return (
    <>
      <Header />
      <main>
        <KwayesCaseStudy />
      </main>
      <Footer />
    </>
  );
}
