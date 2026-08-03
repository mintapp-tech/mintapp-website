import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import InsightsPageContent from "@/components/insights/InsightsPageContent";

export const metadata: Metadata = {
  title: "Insights — Mintapp",
  description:
    "Short writing on building digital products in Egypt and the wider MENA region — product strategy, UX/UI design, and web and mobile development.",
};

export default function InsightsPage() {
  return (
    <>
      <Header />
      <main>
        <InsightsPageContent />
      </main>
      <Footer />
    </>
  );
}
