import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import JameelCaseStudy from "@/components/case-study/JameelCaseStudy";

export const metadata: Metadata = {
  title: "Jameel — Case Study — Mintapp",
  description:
    "How Mintapp built Jameel: a four-sided car wash service marketplace with customer, provider and worker apps plus an admin dashboard.",
};

export default function JameelCaseStudyPage() {
  return (
    <>
      <Header />
      <main>
        <JameelCaseStudy />
      </main>
      <Footer />
    </>
  );
}
