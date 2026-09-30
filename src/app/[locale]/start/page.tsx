import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StartExperience from "@/components/start/StartExperience";
import { resolveLocale } from "@/lib/locales";
import { buildPageMetadata } from "@/lib/seo";

const COPY = {
  en: {
    title: "Start a Project — Mintapp",
    description: "Tell Mintapp what you want to build. Our team studies your idea and prepares an initial direction before your meeting.",
  },
  ar: {
    title: "ابدأ مشروعك — Mintapp",
    description: "أخبر Mintapp بما تريد بناءه. يدرس فريقنا فكرتك ويجهّز اتجاهًا مبدئيًا قبل اجتماعك.",
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  return buildPageMetadata({ locale, path: "/start", ...COPY[locale] });
}

export default function StartPage() {
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="outline-none">
        <StartExperience />
      </main>
      <Footer />
    </>
  );
}
