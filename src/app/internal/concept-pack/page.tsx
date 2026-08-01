import type { Metadata } from "next";
import ConceptPack from "@/components/internal/ConceptPack";

export const metadata: Metadata = {
  title: "Internal — Mintapp",
  robots: { index: false, follow: false, nocache: true },
};

export default function ConceptPackPage() {
  return <ConceptPack />;
}
