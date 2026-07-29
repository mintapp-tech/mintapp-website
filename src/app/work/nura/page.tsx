import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NuraCaseStudy from "@/components/case-study/NuraCaseStudy";

export const metadata: Metadata = {
  title: "Nura — Case Study — Mintapp",
  description:
    "How Mintapp rebuilt Nura's mobile commerce experience around one calm journey, designed Arabic-first from the very first screen.",
};

export default function NuraCaseStudyPage() {
  return (
    <>
      <Header />
      <main>
        <NuraCaseStudy />
      </main>
      <Footer />
    </>
  );
}
