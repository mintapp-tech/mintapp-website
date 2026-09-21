import type { Metadata } from "next";
import Header from "@/components/Header";
import HashScrollHandler from "@/components/HashScrollHandler";
import Hero from "@/components/Hero";
import WorkSection from "@/components/WorkSection";
import ServicesSection from "@/components/ServicesSection";
import ProcessSection from "@/components/ProcessSection";
import DifferentiatorSection from "@/components/DifferentiatorSection";
import InsightsSection from "@/components/InsightsSection";
import FinalCta from "@/components/FinalCta";
import Footer from "@/components/Footer";
import { resolveLocale } from "@/lib/locales";
import { buildPageMetadata } from "@/lib/seo";

const COPY = {
  en: {
    title: "Mintapp — Software that feels easy",
    description:
      "Mintapp is a digital product studio helping startups and growing businesses across Egypt and the MENA region turn ideas into thoughtful, launch-ready websites and mobile apps.",
  },
  ar: {
    title: "Mintapp — برمجيات تُصنع بسهولة",
    description:
      "Mintapp استوديو منتجات رقمية يساعد الشركات الناشئة والنامية في مصر والمنطقة العربية على تحويل أفكارها إلى مواقع وتطبيقات مدروسة وجاهزة للإطلاق.",
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
      <main>
        <Hero />
        <WorkSection />
        <ServicesSection />
        <ProcessSection />
        <DifferentiatorSection />
        <InsightsSection />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
