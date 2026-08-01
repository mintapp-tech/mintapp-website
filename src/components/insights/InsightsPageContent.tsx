"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useLanguage } from "@/lib/language-context";
import { Reveal, RevealGroup, RevealItem } from "@/components/Reveal";
import { SplitReveal } from "@/components/motion/SplitReveal";
import { TiltCard } from "@/components/motion/TiltCard";
import { Magnetic } from "@/components/motion/Magnetic";

export default function InsightsPageContent() {
  const { t, arrow } = useLanguage();
  const insp = t.insp;
  const [activeFilter, setActiveFilter] = useState(0);
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const filteredItems = useMemo(() => {
    if (activeFilter === 0) return insp.items;
    const category = insp.filters[activeFilter];
    return insp.items.filter((item) => item.cat === category);
  }, [activeFilter, insp.filters, insp.items]);

  const handleSubscribe = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) return;
    setSubscribed(true);
  };

  return (
    <>
      <section className="mx-auto max-w-[1280px] px-5 pt-[clamp(34px,5vw,68px)] sm:px-6">
        <SplitReveal
          as="h1"
          text={insp.title}
          className="m-0 text-[clamp(32px,4.6vw,58px)] font-semibold leading-[1.16] tracking-[-0.02em]"
        />
        <Reveal delay={0.1} className="mt-4 max-w-[56ch] text-[16.5px] leading-[1.9] text-ink-soft">
          {insp.sub}
        </Reveal>
      </section>

      <section className="mx-auto mt-[clamp(28px,3.6vw,44px)] max-w-[1280px] px-5 sm:px-6">
        <Reveal className="flex flex-wrap gap-2.5">
          {insp.filters.map((filter, i) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(i)}
              className={`cursor-pointer rounded-full border px-[17px] py-2.5 text-[14.5px] transition-colors ${
                activeFilter === i
                  ? "border-ink bg-ink text-white"
                  : "border-ink/[.14] bg-transparent text-ink-soft hover:border-ink/30 hover:text-ink"
              }`}
            >
              {filter}
            </button>
          ))}
        </Reveal>
      </section>

      <section className="mx-auto mt-[clamp(28px,3.6vw,44px)] max-w-[1280px] px-5 sm:px-6">
        <Reveal className="rounded-[24px] border border-ink/[.08] bg-surface p-[clamp(26px,4vw,50px)]">
          <span className="mb-4 inline-block font-manrope text-[11.5px] font-bold tracking-[.12em] text-mint-deep uppercase">
            {insp.featuredLabel}
          </span>
          <div className="mb-3 font-manrope text-[12px] font-bold tracking-[.1em] text-ink-faint uppercase">
            {insp.featured.cat}
          </div>
          <h2 className="m-0 max-w-[34ch] text-[clamp(24px,2.8vw,36px)] font-semibold leading-[1.28] tracking-[-0.01em]">
            {insp.featured.title}
          </h2>
          <p className="mt-4 max-w-[62ch] text-[16px] leading-[1.85] text-ink-soft">{insp.featured.blurb}</p>
          <span className="mt-6 flex items-center gap-2 text-[14.5px] font-semibold text-dark">
            {insp.read} <span className="block">{arrow}</span>
          </span>
        </Reveal>
      </section>

      <section className="mx-auto mt-[clamp(28px,3.6vw,44px)] max-w-[1280px] px-5 pb-[clamp(56px,7vw,96px)] sm:px-6">
        <RevealGroup className="grid grid-cols-1 gap-[clamp(16px,2.2vw,24px)] sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <RevealItem key={item.title}>
              <TiltCard className="h-full">
                <div className="flex h-full flex-col gap-3.5 rounded-[18px] border border-ink/[.09] bg-canvas p-[clamp(22px,2.4vw,28px)]">
                  <span className="font-manrope text-[11px] font-bold tracking-[.12em] text-mint-deep uppercase">
                    {item.cat}
                  </span>
                  <span className="text-[19px] leading-[1.4] font-semibold tracking-[-0.01em] text-ink">
                    {item.title}
                  </span>
                  <span className="text-[14.5px] leading-[1.8] text-ink-soft">{item.blurb}</span>
                  <span className="mt-auto flex items-center gap-2 pt-2 text-[14px] font-semibold text-dark">
                    {insp.read} <span className="block">{arrow}</span>
                  </span>
                </div>
              </TiltCard>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      <section className="mx-auto max-w-[1280px] px-5 pb-[clamp(60px,8vw,100px)] sm:px-6">
        <Reveal className="relative overflow-hidden rounded-[24px] bg-dark p-[clamp(32px,5vw,56px)] text-center text-canvas">
          <span className="absolute -end-[80px] -top-[80px] block h-[260px] w-[260px] rounded-full bg-mint/10" />
          <h2 className="relative m-0 text-[clamp(24px,2.8vw,34px)] font-semibold tracking-[-0.02em]">
            {insp.ctaTitle}
          </h2>
          <p className="relative mx-auto mt-3 max-w-[44ch] text-[15px] leading-[1.8] text-canvas/70">
            {insp.ctaCopy}
          </p>
          {subscribed ? (
            <p className="relative mt-6 text-[15px] font-semibold text-mint">
              {insp.subscribed} — {email}
            </p>
          ) : (
            <form
              onSubmit={handleSubscribe}
              className="relative mx-auto mt-6 flex max-w-[420px] flex-wrap items-center justify-center gap-3"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={insp.emailPh}
                className="min-w-0 flex-1 rounded-full border border-canvas/24 bg-transparent px-5 py-3 text-[14.5px] text-canvas placeholder:text-canvas/50 focus:border-mint focus:outline-none"
              />
              <Magnetic className="inline-block">
                <button
                  type="submit"
                  className="cursor-pointer rounded-full border-0 bg-mint px-6 py-3 text-[14.5px] font-bold text-dark transition-colors hover:bg-mint-soft"
                >
                  {insp.ctaBtn}
                </button>
              </Magnetic>
            </form>
          )}
        </Reveal>
      </section>
    </>
  );
}
