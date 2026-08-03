import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import KwayesCaseStudy from "@/components/case-study/KwayesCaseStudy";

export const metadata: Metadata = {
  title: "Kwayes — Case Study — Mintapp",
  description:
    "How Mintapp built Kwayes: a social marketplace for selling secondhand goods with photo and video listings and in-app messaging.",
};

export default function KwayesCaseStudyPage() {
  return (
    <>
      <Header />
      <main>
        <KwayesCaseStudy />
      </main>
      <Footer />
    </>
  );
}
