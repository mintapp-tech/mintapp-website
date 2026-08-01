import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NazarihCaseStudy from "@/components/case-study/NazarihCaseStudy";

export const metadata: Metadata = {
  title: "Nazarih — Case Study — Mintapp",
  description:
    "How Mintapp built Nazarih: a multi-category classifieds marketplace spanning real estate, vehicles, hardware and everyday goods.",
};

export default function NazarihCaseStudyPage() {
  return (
    <>
      <Header />
      <main>
        <NazarihCaseStudy />
      </main>
      <Footer />
    </>
  );
}
