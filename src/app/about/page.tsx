import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AboutPageContent from "@/components/about/AboutPageContent";

export const metadata: Metadata = {
  title: "About — Mintapp",
  description:
    "Mintapp is a digital product studio working with founders and small teams in Egypt and MENA to turn early ideas into launch-ready products.",
};

export default function AboutPage() {
  return (
    <>
      <Header />
      <main>
        <AboutPageContent />
      </main>
      <Footer />
    </>
  );
}
