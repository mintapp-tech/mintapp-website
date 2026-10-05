import Link from "next/link";
import { card, primary } from "@/components/dashboard/ui";

export default function InquiryNotFound() {
  return (
    <div className={`${card} mx-auto mt-6 max-w-[520px] px-6 py-12 text-center`}>
      <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em]">Inquiry not found</h1>
      <p className="mt-2 mb-6 text-[14px] leading-relaxed text-ink-soft">The link may be mistyped, or the inquiry may have been removed.</p>
      <Link href="/internal/inquiries" className={primary}>
        Back to all inquiries
      </Link>
    </div>
  );
}
