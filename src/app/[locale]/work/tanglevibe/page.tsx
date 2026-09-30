import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TangleVibeCaseStudy from "@/components/case-study/TangleVibeCaseStudy";
import { resolveLocale } from "@/lib/locales";
import { buildPageMetadata } from "@/lib/seo";

const COPY = {
  en: {
    title: "TangleVibe — Case Study — Mintapp",
    description:
      "How Mintapp built TangleVibe: a dating app designed around intentional matching and conversations that go somewhere.",
  },
  ar: {
    title: "TangleVibe — دراسة حالة — Mintapp",
    description:
      "كيف بنت Mintapp TangleVibe: تطبيق تعارف مبني على مطابقة مقصودة ومحادثات تصل فعلاً إلى نتيجة.",
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  return buildPageMetadata({ locale, path: "/work/tanglevibe", ...COPY[locale] });
}

export default function TangleVibeCaseStudyPage() {
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="outline-none">
        <TangleVibeCaseStudy />
      </main>
      <Footer />
    </>
  );
}
