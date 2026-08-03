import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ServicesPageContent from "@/components/services/ServicesPageContent";

export const metadata: Metadata = {
  title: "Services — Mintapp",
  description:
    "Mintapp builds websites, web apps and mobile apps — one complete process from product strategy through design, development, testing and launch.",
};

export default function ServicesPage() {
  return (
    <>
      <Header />
      <main>
        <ServicesPageContent />
      </main>
      <Footer />
    </>
  );
}
