"use client";

import { useLanguage } from "@/lib/language-context";
import { FIVERR_PROFILE_URL, FIVERR_REVIEWS, FIVERR_SUMMARY, type FiverrReview } from "@/content/fiverr-reviews";
import { Reveal } from "./Reveal";
import { SplitReveal } from "./motion/SplitReveal";

// How many reviews show before "Show all"; the rest open in place (native <details>, no JS).
const VISIBLE = 6;

// Public Fiverr reviews, always next to the profile's real totals and a link to every review.
export default function FiverrReviewsSection() {
  const { t, lang } = useLanguage();
  const f = t.fiverrReviews;
  const countries = new Intl.DisplayNames([lang], { type: "region" });
  const cards = (list: readonly FiverrReview[], offset: number) => (
    <div className="columns-1 gap-[clamp(14px,1.8vw,20px)] md:columns-2 lg:columns-3">
      {list.map((r, i) => (
        <ReviewCard key={offset + i} review={r} country={countries.of(r.country) ?? r.country} />
      ))}
    </div>
  );

  return (
    <section id="fiverr-reviews" className="mx-auto max-w-[1280px] scroll-mt-24 px-5 pt-[clamp(56px,8vw,116px)] sm:px-6">
      <Reveal className="mb-3.5 font-manrope text-[12.5px] font-bold tracking-[.14em] text-mint-deep uppercase">{f.eyebrow}</Reveal>
      <SplitReveal
        as="h2"
        text={f.title}
        className="mb-4 max-w-[22ch] text-[clamp(29px,3.7vw,50px)] leading-[1.2] font-semibold tracking-[-0.02em] text-balance rtl:tracking-normal"
      />
      <Reveal className="mb-[clamp(26px,3.4vw,44px)] flex flex-wrap items-center gap-x-5 gap-y-3">
        <p className="m-0 max-w-[60ch] text-[16px] leading-[1.7] text-ink-soft">{f.source}</p>
        <a
          href={FIVERR_PROFILE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-full border border-ink/[.12] bg-surface px-4 py-2 text-[15px] font-semibold text-ink transition-colors hover:border-mint-deep"
        >
          <span aria-hidden className="text-mint-deep">★</span>
          <bdi>
            {FIVERR_SUMMARY.rating.toFixed(1)} · {FIVERR_SUMMARY.count} {f.reviews}
          </bdi>
          <span className="sr-only">, {f.link}</span>
        </a>
      </Reveal>

      {cards(FIVERR_REVIEWS.slice(0, VISIBLE), 0)}
      {FIVERR_REVIEWS.length > VISIBLE && (
        <details className="group mt-2">
          <summary className="mx-auto mt-4 w-fit cursor-pointer list-none rounded-full border border-ink/[.12] px-5 py-2.5 text-[15px] font-semibold text-dark transition-colors hover:border-mint-deep group-open:hidden [&::-webkit-details-marker]:hidden">
            {f.showAll} ({FIVERR_REVIEWS.length})
          </summary>
          <div className="mt-[clamp(14px,1.8vw,20px)]">{cards(FIVERR_REVIEWS.slice(VISIBLE), VISIBLE)}</div>
        </details>
      )}
      <a
        href={FIVERR_PROFILE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 flex w-fit items-center gap-2 border-0 border-b-[1.5px] border-mint pb-1 text-[15px] font-semibold text-dark"
      >
        {f.link} <span aria-hidden>↗</span>
      </a>
    </section>
  );
}

function ReviewCard({ review, country }: { review: FiverrReview; country: string }) {
  const { t, lang } = useLanguage();
  return (
    <figure className="m-0 mb-[clamp(14px,1.8vw,20px)] break-inside-avoid rounded-[18px] border border-ink/[.09] bg-surface p-[clamp(18px,2vw,24px)]">
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
        <p className="m-0 text-[16px] leading-[1.7] whitespace-pre-line text-ink text-pretty">{review.quote}</p>
      </blockquote>
      <figcaption className="mt-4 text-[13.5px] text-ink-faint">
        <bdi className="font-semibold text-ink-soft">{review.user}</bdi> · {country}
      </figcaption>
    </figure>
  );
}
