import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProjectCaseStudy from "@/components/case-study/ProjectCaseStudy";
import { resolveLocale } from "@/lib/locales";
import { buildPageMetadata } from "@/lib/seo";

const COPY = {
  en: {
    title: "whHR — Case Study — Mintapp",
    description:
      "How Mintapp designed whHR: an employee app for checking in, tracking attendance, overtime and gatepasses, and viewing HR records.",
  },
  ar: {
    title: "whHR — دراسة حالة — Mintapp",
    description:
      "كيف صممت Mintapp تطبيق whHR: تطبيق للموظفين لتسجيل الحضور ومتابعة الدوام والعمل الإضافي وتصاريح الخروج والاطلاع على بيانات الموارد البشرية.",
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  return buildPageMetadata({ locale, path: "/work/whhr", ...COPY[locale] });
}

export default function WhhrCaseStudyPage() {
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="outline-none">
        <ProjectCaseStudy
          slug="whhr"
          csKey="csWhhr"
          theme={{ bg: "bg-whhr-bg", blob: "bg-whhr/[.16]", swatches: ["bg-whhr", "bg-whhr-2", "bg-dark"] }}
        />
      </main>
      <Footer />
    </>
  );
}
