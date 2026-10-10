import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StartExperience from "@/components/start/StartExperience";
import { resolveLocale } from "@/lib/locales";
import { buildPageMetadata } from "@/lib/seo";
import { BUDGET_CURRENCY_COOKIE, COUNTRY_HEADER, initialBudgetCurrency } from "@/lib/budget-currency";

// Rendered for each request, never from a shared cache: the budget question starts
// in the visitor's own saved currency, else the one their country suggests (only
// the two-letter country the host adds; no IP address is read or kept).
export const dynamic = "force-dynamic";

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

export default async function StartPage() {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const currency = initialBudgetCurrency({ preference: cookieStore.get(BUDGET_CURRENCY_COOKIE)?.value, country: requestHeaders.get(COUNTRY_HEADER) });
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="outline-none">
        <StartExperience initialBudgetCurrency={currency} />
      </main>
      <Footer />
    </>
  );
}
