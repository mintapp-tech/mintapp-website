import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PrivacyPageContent from "@/components/privacy/PrivacyPageContent";

export const metadata: Metadata = {
  title: "Privacy Policy — Mintapp",
  description: "How Mintapp collects, uses and protects the information you share with us through this website.",
};

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main>
        <PrivacyPageContent />
      </main>
      <Footer />
    </>
  );
}
