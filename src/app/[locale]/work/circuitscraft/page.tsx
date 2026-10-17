import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProjectCaseStudy from "@/components/case-study/ProjectCaseStudy";
import { resolveLocale } from "@/lib/locales";
import { buildPageMetadata } from "@/lib/seo";

const COPY = {
  en: {
    title: "CircuitsCraft — Case Study — Mintapp",
    description:
      "How Mintapp designed CircuitsCraft: a VR/AR game for building electronic circuits in 3D space, with a component library, breadboard, microcontroller code editor and a player marketplace.",
  },
  ar: {
    title: "CircuitsCraft — دراسة حالة — Mintapp",
    description:
      "كيف صممت Mintapp لعبة CircuitsCraft: لعبة بالواقع الافتراضي والمعزّز لبناء الدوائر الإلكترونية في فضاء ثلاثي الأبعاد، مع مكتبة مكوّنات ولوحة تجارب ومحرر كود للمتحكم الدقيق وسوق للاعبين.",
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  return buildPageMetadata({ locale, path: "/work/circuitscraft", ...COPY[locale] });
}

export default function CircuitsCraftCaseStudyPage() {
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="outline-none">
        <ProjectCaseStudy
          slug="circuitscraft"
          csKey="csCircuitsCraft"
          theme={{ bg: "bg-circuitscraft-bg", blob: "bg-circuitscraft/[.16]", swatches: ["bg-circuitscraft", "bg-circuitscraft-2", "bg-dark"] }}
        />
      </main>
      <Footer />
    </>
  );
}
