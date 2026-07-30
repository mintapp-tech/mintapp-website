import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RentopCaseStudy from "@/components/case-study/RentopCaseStudy";

export const metadata: Metadata = {
  title: "Rentop — Case Study — Mintapp",
  description:
    "How Mintapp built Rentop: a consumer car rental app for browsing by brand and category and booking directly, built for the UAE market.",
};

export default function RentopCaseStudyPage() {
  return (
    <>
      <Header />
      <main>
        <RentopCaseStudy />
      </main>
      <Footer />
    </>
  );
}
