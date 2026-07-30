import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TaskatyCaseStudy from "@/components/case-study/TaskatyCaseStudy";

export const metadata: Metadata = {
  title: "Taskaty — Case Study — Mintapp",
  description:
    "How Mintapp built Taskaty: a focused task management app that gives small teams one shared view of what's assigned, due and done.",
};

export default function TaskatyCaseStudyPage() {
  return (
    <>
      <Header />
      <main>
        <TaskatyCaseStudy />
      </main>
      <Footer />
    </>
  );
}
