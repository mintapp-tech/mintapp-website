import Header from "@/components/Header";
import Hero from "@/components/Hero";
import WorkSection from "@/components/WorkSection";
import ServicesSection from "@/components/ServicesSection";
import ProcessSection from "@/components/ProcessSection";
import DifferentiatorSection from "@/components/DifferentiatorSection";
import InsightsSection from "@/components/InsightsSection";
import FinalCta from "@/components/FinalCta";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <WorkSection />
        <ServicesSection />
        <ProcessSection />
        <DifferentiatorSection />
        <InsightsSection />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
