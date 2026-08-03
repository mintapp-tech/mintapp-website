import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ArrentioCaseStudy from "@/components/case-study/ArrentioCaseStudy";

export const metadata: Metadata = {
  title: "Arrentio — Case Study — Mintapp",
  description:
    "How Mintapp built Arrentio: a verified car rental marketplace and agency platform with multi-tenant storefronts, designed for Indonesia and the Gulf.",
};

export default function ArrentioCaseStudyPage() {
  return (
    <>
      <Header />
      <main>
        <ArrentioCaseStudy />
      </main>
      <Footer />
    </>
  );
}
