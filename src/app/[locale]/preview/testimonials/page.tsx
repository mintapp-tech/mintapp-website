import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import TestimonialsSection from "@/components/TestimonialsSection";

// Development-only layout review of "What our clients say" using clearly marked
// fixtures. It does not exist in production builds, and is never linked or
// listed in the sitemap.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function TestimonialsPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  const { TESTIMONIAL_FIXTURES } = await import("@/content/testimonial-fixtures");
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="outline-none">
        <p
          role="note"
          className="mx-auto mt-6 max-w-[1240px] rounded-2xl border-2 border-dashed border-red-500 bg-red-50 px-5 py-3 text-[14px] font-semibold text-red-700"
        >
          Development preview with FIXTURE content. These are not client testimonials and this page does not exist in production.
        </p>
        <TestimonialsSection items={TESTIMONIAL_FIXTURES} />
        <div className="h-24" />
      </main>
    </>
  );
}
