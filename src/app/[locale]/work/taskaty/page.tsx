import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TaskatyCaseStudy from "@/components/case-study/TaskatyCaseStudy";
import { resolveLocale } from "@/lib/locales";
import { buildPageMetadata } from "@/lib/seo";

const COPY = {
  en: {
    title: "Taskaty — Case Study — Mintapp",
    description:
      "How Mintapp built Taskaty: a focused task management app that gives small teams one shared view of what's assigned, due and done.",
  },
  ar: {
    title: "Taskaty — دراسة حالة — Mintapp",
    description:
      "كيف بنت Mintapp Taskaty: تطبيق إدارة مهام مركّز يمنح الفرق الصغيرة رؤية واحدة مشتركة لما هو مُسنَد ومستحق ومنجز.",
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  return buildPageMetadata({ locale, path: "/work/taskaty", ...COPY[locale] });
}

export default function TaskatyCaseStudyPage() {
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="outline-none">
        <TaskatyCaseStudy />
      </main>
      <Footer />
    </>
  );
}
