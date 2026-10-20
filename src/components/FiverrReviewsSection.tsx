"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/language-context";
import { COUNTRY_NAMES, FIVERR_PROFILE_URL, FIVERR_REVIEWS, FIVERR_SUMMARY, type FiverrReview } from "@/content/fiverr-reviews";
import { Reveal } from "./Reveal";

// ponytail: length heuristic instead of measuring overflow; about five lines at the card's width.
const LONG_QUOTE = 170;

// A compact follow-on to "What our clients say": public Fiverr reviews in one
// row the visitor scrolls sideways (never auto-rotating), always next to the
// profile's real totals and a link to every review.
export default function FiverrReviewsSection() {
  const { t, lang } = useLanguage();
  const f = t.fiverrReviews;
  const countries = new Intl.DisplayNames([lang], { type: "region" });

  return (
    <section id="fiverr-reviews" className="mx-auto max-w-[1280px] scroll-mt-24 px-5 pt-[clamp(36px,4.5vw,60px)] sm:px-6">
      <Reveal className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-3">
        <h3 className="m-0 text-[clamp(21px,1.9vw,26px)] font-semibold tracking-[-0.01em] text-ink rtl:tracking-normal">{f.title}</h3>
        <a
          href={FIVERR_PROFILE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-full border border-ink/[.12] bg-surface px-4 py-1.5 text-[14.5px] font-semibold text-ink transition-colors hover:border-mint-deep"
        >
          <span aria-hidden className="text-mint-deep">★</span>
          <bdi>
            {FIVERR_SUMMARY.rating.toFixed(1)} · {FIVERR_SUMMARY.count} {f.reviews}
          </bdi>
          <span aria-hidden>↗</span>
          <span className="sr-only">, {f.link}</span>
        </a>
        <p className="m-0 basis-full text-[14.5px] leading-[1.6] text-ink-faint">{f.source}</p>
      </Reveal>

      <div
        role="region"
        aria-label={f.rowLabel}
        tabIndex={0}
        className="-mx-5 flex snap-x snap-mandatory items-start gap-[clamp(14px,1.6vw,18px)] overflow-x-auto scroll-px-5 px-5 pb-4 outline-none focus-visible:ring-2 focus-visible:ring-mint sm:-mx-6 sm:scroll-px-6 sm:px-6 [mask-image:linear-gradient(to_right,#000_88%,transparent)] rtl:[mask-image:linear-gradient(to_left,#000_88%,transparent)]"
      >
        {FIVERR_REVIEWS.map((r, i) => (
          <ReviewCard key={i} review={r} country={COUNTRY_NAMES[r.country]?.[lang] ?? countries.of(r.country) ?? r.country} />
        ))}
      </div>
    </section>
  );
}

function ReviewCard({ review, country }: { review: FiverrReview; country: string }) {
  const { t, lang, arrow } = useLanguage();
  const [open, setOpen] = useState(false);
  const long = review.quote.length > LONG_QUOTE;
  return (
    <figure className="m-0 flex w-[min(82vw,330px)] flex-none snap-start flex-col rounded-[18px] border border-ink/[.09] bg-surface p-[clamp(18px,2vw,22px)]">
      <span className="flex items-center gap-1.5 text-[14px] font-bold text-mint-deep" aria-label={`${review.rating.toFixed(1)} ${t.fiverrReviews.ratingLabel}`}>
        <span aria-hidden>★</span>
        <span aria-hidden>{review.rating.toFixed(1)}</span>
      </span>
      <blockquote
        lang={review.quoteLanguage}
        dir="auto"
        className="m-0 mt-3"
        // A quote kept in its original language uses that language's typeface.
        style={review.quoteLanguage !== lang ? { fontFamily: review.quoteLanguage === "ar" ? "var(--font-alexandria)" : "var(--font-manrope)" } : undefined}
      >
        <p className={`m-0 text-[15.5px] leading-[1.65] whitespace-pre-line text-ink text-pretty ${long && !open ? "line-clamp-5" : ""}`}>{review.quote}</p>
      </blockquote>
      {long && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="mt-2 w-fit cursor-pointer border-0 bg-transparent p-0 text-[14px] font-semibold text-mint-deep underline-offset-4 hover:underline"
        >
          {open ? t.fiverrReviews.readLess : t.fiverrReviews.readMore}
        </button>
      )}
      <figcaption className="mt-4 text-[13.5px] text-ink-faint">
        <bdi className="font-semibold text-ink-soft">{review.user}</bdi> · {country}
      </figcaption>
      {review.project && (
        <Link
          href={`/${lang}/work/${review.project}`}
          className="mt-4 flex w-fit items-center gap-2 border-0 border-b-[1.5px] border-mint pb-1 text-[14.5px] font-semibold text-dark transition-all hover:gap-3"
        >
          {t.work.cta} <span className="block">{arrow}</span>
        </Link>
      )}
    </figure>
  );
}
