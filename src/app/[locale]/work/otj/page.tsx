import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProjectCaseStudy from "@/components/case-study/ProjectCaseStudy";
import { resolveLocale } from "@/lib/locales";
import { buildPageMetadata } from "@/lib/seo";

const COPY = {
  en: {
    title: "OTJ — Case Study — Mintapp",
    description:
      "How Mintapp built OTJ: a marketplace where clients book creatives for one-off projects and run them from brief to proposal, payment and delivery.",
  },
  ar: {
    title: "OTJ — دراسة حالة — Mintapp",
    description:
      "كيف بنت Mintapp منصة OTJ: سوق يحجز فيه العملاء المبدعين لمشاريع لمرة واحدة ويديرونها من الطلب إلى العرض والدفع والتسليم.",
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  return buildPageMetadata({ locale, path: "/work/otj", ...COPY[locale] });
}

export default function OtjCaseStudyPage() {
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="outline-none">
        <ProjectCaseStudy
          slug="otj"
          csKey="csOtj"
          theme={{ bg: "bg-otj-bg", blob: "bg-otj-2/[.12]", swatches: ["bg-otj", "bg-otj-2", "bg-otj-bg"] }}
        />
      </main>
      <Footer />
    </>
  );
}
