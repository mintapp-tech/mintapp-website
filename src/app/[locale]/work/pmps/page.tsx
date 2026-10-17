import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProjectCaseStudy from "@/components/case-study/ProjectCaseStudy";
import { resolveLocale } from "@/lib/locales";
import { buildPageMetadata } from "@/lib/seo";

const COPY = {
  en: {
    title: "PMPS — Case Study — Mintapp",
    description:
      "How Mintapp designed the PMPS website: a construction and project management consultancy site covering services, industries and project case pages.",
  },
  ar: {
    title: "PMPS — دراسة حالة — Mintapp",
    description:
      "كيف صممت Mintapp موقع PMPS: موقع لشركة استشارات في إدارة الإنشاءات والمشاريع يعرض الخدمات والقطاعات وصفحات المشاريع.",
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  return buildPageMetadata({ locale, path: "/work/pmps", ...COPY[locale] });
}

export default function PmpsCaseStudyPage() {
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="outline-none">
        <ProjectCaseStudy
          slug="pmps"
          csKey="csPmps"
          theme={{ bg: "bg-pmps-bg", blob: "bg-pmps/[.16]", swatches: ["bg-pmps", "bg-pmps-2", "bg-dark"] }}
        />
      </main>
      <Footer />
    </>
  );
}
