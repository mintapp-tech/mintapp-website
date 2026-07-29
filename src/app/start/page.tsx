import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StartExperience from "@/components/start/StartExperience";

export const metadata: Metadata = {
  title: "Start a Project — Mintapp",
  description: "Tell Mintapp what you want to build. Our team studies your idea and prepares an initial direction before your meeting.",
};

export default function StartPage() {
  return (
    <>
      <Header />
      <main>
        <StartExperience />
      </main>
      <Footer />
    </>
  );
}
