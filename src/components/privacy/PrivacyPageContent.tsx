"use client";

import { useLanguage } from "@/lib/language-context";
import { Reveal, RevealGroup, RevealItem } from "@/components/Reveal";
import { SplitReveal } from "@/components/motion/SplitReveal";

function SectionBlock({ title, body, list }: { title: string; body: string; list?: string[] }) {
  return (
    <Reveal as="div" className="border-b border-ink/[.08] py-[clamp(22px,3vw,32px)] first:pt-0 last:border-b-0">
      <h2 className="m-0 mb-3 text-[clamp(18px,2vw,22px)] font-semibold tracking-[-0.01em]">{title}</h2>
      <p className="m-0 max-w-[68ch] text-[15.5px] leading-[1.9] text-ink-soft">{body}</p>
      {list && (
        <div className="mt-4 flex flex-col gap-2.5">
          {list.map((item) => (
            <div key={item} className="flex items-start gap-2.5 text-[14.5px] leading-[1.7] text-ink">
              <span className="mt-2 block h-[5px] w-[5px] flex-none rounded-full bg-mint-deep" />
              <span className="max-w-[62ch]">{item}</span>
            </div>
          ))}
        </div>
      )}
    </Reveal>
  );
}

export default function PrivacyPageContent() {
  const { t } = useLanguage();
  const p = t.privacy;

  // "Who else may process your information" is authored as section index 4 —
  // the processor list renders right after it as its own visual block.
  const before = p.sections.slice(0, 5);
  const after = p.sections.slice(5);

  return (
    <>
      <section className="mx-auto max-w-[860px] px-5 pt-[clamp(34px,5vw,68px)] sm:px-6">
        <SplitReveal
          as="h1"
          text={p.title}
          className="m-0 text-[clamp(30px,4vw,48px)] font-semibold leading-[1.18] tracking-[-0.02em] text-balance"
        />
        <Reveal delay={0.1} className="mx-auto mt-4 max-w-[60ch] text-[16.5px] leading-[1.85] text-ink-soft">
          {p.sub}
        </Reveal>
        <Reveal delay={0.15} className="mt-5 inline-flex items-center gap-2 rounded-full border border-ink/[.1] bg-surface px-4 py-1.5 text-[12.5px] font-medium text-ink-soft">
          {p.updated}
        </Reveal>
      </section>

      <section className="mx-auto mt-[clamp(40px,5vw,64px)] max-w-[860px] px-5 sm:px-6">
        <div className="rounded-[24px] border border-ink/[.08] bg-surface px-[clamp(22px,4vw,44px)]">
          {before.map((s) => (
            <SectionBlock key={s.title} title={s.title} body={s.body} list={s.list} />
          ))}
        </div>

        <Reveal className="mt-[clamp(20px,2.6vw,28px)]">
          <div className="mb-3 font-manrope text-[11.5px] font-bold tracking-[.12em] text-mint-deep uppercase">
            {p.processorsTitle}
          </div>
          <RevealGroup className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {p.processors.map((proc) => (
              <RevealItem
                key={proc.name}
                className="flex items-center justify-between gap-4 rounded-2xl border border-ink/[.08] bg-canvas px-5 py-4"
              >
                <span className="text-[15px] font-semibold text-ink">{proc.name}</span>
                <span className="text-end text-[13.5px] text-ink-soft">{proc.role}</span>
              </RevealItem>
            ))}
          </RevealGroup>
        </Reveal>

        <div className="mt-[clamp(20px,2.6vw,28px)] rounded-[24px] border border-ink/[.08] bg-surface px-[clamp(22px,4vw,44px)]">
          {after.map((s) => (
            <SectionBlock key={s.title} title={s.title} body={s.body} list={s.list} />
          ))}
        </div>
      </section>

      <section className="mx-auto mt-[clamp(40px,5vw,64px)] max-w-[860px] px-5 pb-[clamp(60px,8vw,100px)] sm:px-6">
        <Reveal className="rounded-[24px] bg-dark px-[clamp(24px,4vw,44px)] py-[clamp(28px,4vw,40px)] text-canvas">
          <div className="text-[16.5px] font-semibold">{p.contactTitle}</div>
          <p className="m-0 mt-2 max-w-[52ch] text-[14.5px] leading-[1.8] text-canvas/70">{p.contactCopy}</p>
          <a
            href={`mailto:${p.contactEmail}`}
            className="mt-4 inline-block text-[15px] font-semibold text-mint underline decoration-mint/50 decoration-[1.5px] underline-offset-4 transition-colors hover:text-mint-soft"
          >
            {p.contactEmail}
          </a>
        </Reveal>
        <p className="m-0 mt-6 max-w-[68ch] text-[13px] leading-[1.8] text-ink-faint">{p.disclaimer}</p>
      </section>
    </>
  );
}
