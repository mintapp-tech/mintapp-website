import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ServicesPageContent from "@/components/services/ServicesPageContent";
import { resolveLocale } from "@/lib/locales";
import { buildPageMetadata } from "@/lib/seo";

const COPY = {
  en: {
    title: "Services — Mintapp",
    description:
      "Mintapp builds websites, web apps and mobile apps — one complete process from product strategy through design, development, testing and launch.",
  },
  ar: {
    title: "خدماتنا — Mintapp",
    description:
      "Mintapp تبني مواقع وتطبيقات ويب وموبايل — عملية واحدة متكاملة من استراتيجية المنتج إلى التصميم والتطوير والاختبار والإطلاق.",
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  return buildPageMetadata({ locale, path: "/services", ...COPY[locale] });
}

export default function ServicesPage() {
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="outline-none">
        <ServicesPageContent />
      </main>
      <Footer />
    </>
  );
}
