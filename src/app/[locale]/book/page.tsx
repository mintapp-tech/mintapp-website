import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BookingRecoveryView, { type BookingRecoveryViewProps } from "@/components/start/BookingRecoveryView";
import { formatMeetingTime, resolveBookingRecovery } from "@/lib/booking-recovery";
import { resolveLocale } from "@/lib/locales";
import { en } from "@/lib/i18n/en";
import { ar } from "@/lib/i18n/ar";

// The page behind the "Choose a call time" button in the acknowledgment email.
// It is a private recovery path, reached only from that link:
//  - decided on the server for every request and never cached;
//  - never indexed, never in the sitemap, never sends a referrer, so the
//    reference in the address is not passed on to anything the page loads.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  return {
    title: `${(locale === "ar" ? ar : en).book.metaTitle} | Mintapp`,
    robots: { index: false, follow: false, nocache: true },
    referrer: "no-referrer",
  };
}

export default async function BookPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const locale = resolveLocale((await params).locale);
  const reference = (await searchParams).ref;
  const outcome = await resolveBookingRecovery(reference);

  const view: BookingRecoveryViewProps =
    outcome.state === "booked" ? { state: "booked", when: formatMeetingTime(outcome.startsAt, outcome.timezone, locale), manageUrl: outcome.manageUrl } : outcome;

  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="outline-none">
        <BookingRecoveryView {...view} />
      </main>
      <Footer />
    </>
  );
}
