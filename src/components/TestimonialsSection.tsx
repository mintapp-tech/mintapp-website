"use client";

import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useLanguage } from "@/lib/language-context";
import { testimonialForLocale, type Testimonial } from "@/content/testimonials";
import { Reveal, RevealGroup, RevealItem } from "./Reveal";
import { SplitReveal } from "./motion/SplitReveal";

const initials = (name?: string) =>
  (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

// "What our clients say": readable cards, never an auto-rotating carousel.
// Receives only entries that passed the publication check; with none, the
// section is not rendered at all (no empty or placeholder state).
export default function TestimonialsSection({ items }: { items: readonly Testimonial[] }) {
  const { t, lang, arrow } = useLanguage();
  if (items.length === 0) return null;
  const cards = items.map((item) => testimonialForLocale(item, lang));
  const columns = cards.length === 1 ? "max-w-[760px]" : cards.length === 2 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3";

  return (
    <section id="testimonials" className="mx-auto max-w-[1280px] scroll-mt-24 px-5 pt-[clamp(56px,8vw,116px)] sm:px-6">
      <Reveal className="mb-3.5 font-manrope text-[12.5px] font-bold tracking-[.14em] text-mint-deep uppercase">
        {t.testimonials.eyebrow}
      </Reveal>
      <SplitReveal
        as="h2"
        text={t.testimonials.title}
        className="mb-[clamp(30px,4vw,52px)] max-w-[22ch] text-[clamp(29px,3.7vw,50px)] leading-[1.2] font-semibold tracking-[-0.02em] text-balance rtl:tracking-normal"
      />

      <RevealGroup className={`grid grid-cols-1 gap-[clamp(18px,2.4vw,26px)] ${columns}`}>
        {cards.map((card, i) => {
          const attribution = [card.role, card.company].filter(Boolean).join(" · ");
          return (
            <RevealItem key={card.id} className="h-full">
              <figure className="m-0 flex h-full flex-col rounded-[20px] border border-ink/[.09] bg-surface p-[clamp(24px,2.6vw,34px)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_30px_60px_-46px_rgba(7,27,22,.5)]">
                <span
                  aria-hidden
                  className="mt-node flex h-10 w-10 items-center justify-center rounded-[12px] bg-dark"
                  style={{ "--mt-delay": `${(0.25 + i * 0.12).toFixed(2)}s` } as CSSProperties}
                >
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-mint rtl:-scale-x-100">
                    <path d="M4 18v-5.4C4 8.4 6.3 5.6 10.4 5l.6 1.9c-2.2.6-3.4 2.1-3.6 4.1H10v7H4Zm10 0v-5.4c0-4.2 2.3-7 6.4-7.6l.6 1.9c-2.2.6-3.4 2.1-3.6 4.1H20v7h-6Z" />
                  </svg>
                </span>
                <blockquote
                  lang={card.quoteLanguage}
                  dir="auto"
                  className="m-0 mt-5 flex-1"
                  // A quote kept in its original language uses that language's typeface.
                  style={card.quoteLanguage !== lang ? { fontFamily: card.quoteLanguage === "ar" ? "var(--font-alexandria)" : "var(--font-manrope)" } : undefined}
                >
                  <p className="m-0 text-[clamp(16.5px,1.35vw,18.5px)] leading-[1.8] text-ink text-pretty">{card.quote}</p>
                  {card.quoteLanguage !== lang && <p className="m-0 mt-3 text-[13px] text-ink-faint">{t.testimonials.quotedIn[card.quoteLanguage]}</p>}
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-ink/[.08] pt-5">
                  {card.logo ? (
                    // The company's own logo, unaltered; the company is also named in text beside it.
                    <span className="flex h-11 w-[72px] flex-none items-center">
                      <Image src={card.logo.src} alt="" width={card.logo.width} height={card.logo.height} className="h-auto max-h-[24px] w-auto max-w-[72px]" />
                    </span>
                  ) : card.photo ? (
                    <Image src={card.photo} alt="" width={44} height={44} className="h-11 w-11 flex-none rounded-full object-cover" />
                  ) : card.name ? (
                    // A person's initials only; an organization never gets a made-up mark.
                    <span aria-hidden className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-mint-soft font-manrope text-[14px] font-bold text-mint-deep">
                      {initials(card.name)}
                    </span>
                  ) : null}
                  <span className="min-w-0">
                    {card.name && (
                      <span className="block text-[15.5px] font-semibold text-ink">
                        <bdi>{card.name}</bdi>
                      </span>
                    )}
                    {attribution && (
                      // Without a personal name, the role and organization are the main attribution.
                      <span className={card.name ? "block text-[14px] leading-[1.5] text-ink-soft" : "block text-[15.5px] leading-[1.5] font-semibold text-ink"} data-attribution>
                        <bdi>{attribution}</bdi>
                      </span>
                    )}
                  </span>
                </figcaption>
                {card.project && (
                  <Link
                    href={`/${lang}/work/${card.project}`}
                    className="mt-5 flex w-fit items-center gap-2 border-0 border-b-[1.5px] border-mint bg-transparent pb-1 text-[15px] font-semibold text-dark transition-all hover:gap-3.5"
                  >
                    {t.work.cta} <span className="block">{arrow}</span>
                  </Link>
                )}
              </figure>
            </RevealItem>
          );
        })}
      </RevealGroup>
    </section>
  );
}
