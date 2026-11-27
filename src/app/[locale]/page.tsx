import type { Metadata } from "next";
import Header from "@/components/Header";
import HashScrollHandler from "@/components/HashScrollHandler";
import Hero from "@/components/Hero";
import WorkSection from "@/components/WorkSection";
import ServicesSection from "@/components/ServicesSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import { publishableTestimonials } from "@/content/testimonials";
import FiverrReviewsSection from "@/components/FiverrReviewsSection";
import TeamSection from "@/components/TeamSection";
import ProcessSection from "@/components/ProcessSection";
import FinalCta from "@/components/FinalCta";
import Footer from "@/components/Footer";
import { resolveLocale } from "@/lib/locales";
import { buildPageMetadata } from "@/lib/seo";

const COPY = {
  en: {
    title: "Mintapp — Software that feels easy",
    description:
      "Mintapp designs and builds websites, apps and internal systems for founders and teams in Egypt, MENA and beyond. The first discovery meeting is free.",
  },
  ar: {
    title: "Mintapp — برمجيات تُصنع بسهولة",
    description:
      "تصمّم Mintapp وتطوّر المواقع والتطبيقات والأنظمة الداخلية للمؤسسين والفرق في مصر والمنطقة العربية وخارجها. الاجتماع الاستكشافي الأول مجاني.",
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  return buildPageMetadata({ locale, path: "", ...COPY[locale] });
}

export default function Home() {
  return (
    <>
      <HashScrollHandler />
      <Header />
      <main id="main-content" tabIndex={-1} className="outline-none">
        <Hero />
        <ProcessSection />
        <WorkSection />
        {/* Only approved testimonials; with none, the section is not rendered. */}
        <TestimonialsSection items={publishableTestimonials()} />
        <FiverrReviewsSection />
        <TeamSection />
        <ServicesSection />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
