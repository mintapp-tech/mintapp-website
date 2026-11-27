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
      "Websites, web and mobile applications, product design and UI/UX, internal systems and automation: one process from product strategy to launch.",
  },
  ar: {
    title: "خدماتنا — Mintapp",
    description:
      "مواقع إلكترونية وتطبيقات ويب وموبايل، وتصميم منتجات وواجهات، وأنظمة داخلية وأتمتة: عملية واحدة من استراتيجية المنتج حتى الإطلاق.",
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
