import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PrivacyPageContent from "@/components/privacy/PrivacyPageContent";
import { resolveLocale } from "@/lib/locales";
import { buildPageMetadata } from "@/lib/seo";

const COPY = {
  en: {
    title: "Privacy Policy — Mintapp",
    description: "How Mintapp collects, uses and protects the information you share with us through this website.",
  },
  ar: {
    title: "سياسة الخصوصية — Mintapp",
    description: "كيف تجمع Mintapp المعلومات التي تشاركها معنا عبر هذا الموقع وكيف نستخدمها ونحميها.",
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  return buildPageMetadata({ locale, path: "/privacy", ...COPY[locale] });
}

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="outline-none">
        <PrivacyPageContent />
      </main>
      <Footer />
    </>
  );
}
