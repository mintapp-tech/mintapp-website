import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProjectCaseStudy from "@/components/case-study/ProjectCaseStudy";
import { resolveLocale } from "@/lib/locales";
import { buildPageMetadata } from "@/lib/seo";

const COPY = {
  en: {
    title: "Budgetly — Case Study — Mintapp",
    description:
      "How Mintapp designed Budgetly: a personal budgeting app with receipt scanning, linked accounts and monthly budgets by category.",
  },
  ar: {
    title: "Budgetly — دراسة حالة — Mintapp",
    description:
      "كيف صممت Mintapp تطبيق Budgetly: تطبيق لإدارة الميزانية الشخصية مع مسح الإيصالات وربط الحسابات وميزانيات شهرية حسب الفئة.",
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  return buildPageMetadata({ locale, path: "/work/budgetly", ...COPY[locale] });
}

export default function BudgetlyCaseStudyPage() {
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="outline-none">
        <ProjectCaseStudy
          slug="budgetly"
          csKey="csBudgetly"
          theme={{ bg: "bg-budgetly-bg", blob: "bg-budgetly/[.16]", swatches: ["bg-budgetly", "bg-budgetly-2", "bg-dark"] }}
        />
      </main>
      <Footer />
    </>
  );
}
