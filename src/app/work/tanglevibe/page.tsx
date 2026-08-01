import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TangleVibeCaseStudy from "@/components/case-study/TangleVibeCaseStudy";

export const metadata: Metadata = {
  title: "TangleVibe — Case Study — Mintapp",
  description:
    "How Mintapp built TangleVibe: a dating app designed around intentional matching and conversations that go somewhere.",
};

export default function TangleVibeCaseStudyPage() {
  return (
    <>
      <Header />
      <main>
        <TangleVibeCaseStudy />
      </main>
      <Footer />
    </>
  );
}
