"use client";

import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/language-context";
import { Reveal, RevealGroup, RevealItem } from "@/components/Reveal";
import { SplitReveal } from "@/components/motion/SplitReveal";
import { Magnetic } from "@/components/motion/Magnetic";

const iconIndex = [
  <span key="a" className="block h-[14px] w-[18px] rounded-[3px] border-2 border-mint" />,
  <span key="b" className="block h-[19px] w-3 rounded-[4px] border-2 border-mint" />,
];

const relatedSlugs = ["arrentio", "rentop"];

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="mb-3 font-manrope text-[11.5px] font-bold tracking-[.12em] text-ink-faint uppercase">
        {title}
      </div>
      <div className="flex flex-col gap-2.5">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-2.5 text-[14.5px] leading-[1.7] text-ink">
            <span className="mt-2 block h-[5px] w-[5px] flex-none rounded-full bg-mint-deep" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ServicesPageContent() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const svcp = t.svcp;

  return (
    <>
      <section className="mx-auto max-w-[1280px] px-5 pt-[clamp(34px,5vw,68px)] text-center sm:px-6">
        <SplitReveal
          as="h1"
          text={svcp.title}
          className="mx-auto m-0 max-w-[26ch] text-[clamp(30px,4vw,50px)] font-semibold leading-[1.18] tracking-[-0.02em] text-balance"
        />
        <Reveal delay={0.1} className="mx-auto mt-5 max-w-[62ch] text-[16.5px] leading-[1.9] text-ink-soft">
          {svcp.sub}
        </Reveal>
      </section>

      {svcp.cats.map((cat, i) => (
        <section
          key={cat.name}
          className="mx-auto mt-[clamp(56px,7vw,96px)] max-w-[1280px] px-5 sm:px-6"
        >
          <Reveal className="rounded-[24px] border border-ink/[.08] bg-surface p-[clamp(26px,4vw,54px)]">
            <div className="flex flex-wrap items-start justify-between gap-6 border-b border-ink/[.08] pb-[clamp(24px,3vw,34px)]">
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[13px] bg-dark">
                  {iconIndex[i % 2]}
                </span>
                <div>
                  <h2 className="m-0 text-[clamp(24px,2.6vw,34px)] font-semibold tracking-[-0.01em]">{cat.name}</h2>
                  <p className="mt-2 max-w-[56ch] text-[15.5px] leading-[1.85] text-ink-soft">{cat.desc}</p>
                </div>
              </div>
              <Magnetic className="inline-block flex-none">
                <button
                  onClick={() => router.push(`/${lang}/start`)}
                  className="cursor-pointer rounded-full border-0 bg-ink px-6 py-3 text-[14.5px] font-semibold text-white transition-colors hover:bg-mint hover:text-dark"
                >
                  {svcp.cta}
                </button>
              </Magnetic>
            </div>

            <RevealGroup className="grid grid-cols-1 gap-x-8 gap-y-8 pt-[clamp(24px,3vw,34px)] sm:grid-cols-2">
              <RevealItem>
                <ListBlock title={svcp.fitTitle} items={cat.fit} />
              </RevealItem>
              <RevealItem>
                <ListBlock title={svcp.delivTitle} items={cat.deliv} />
              </RevealItem>
              <RevealItem>
                <ListBlock title={svcp.capsTitle} items={cat.caps} />
              </RevealItem>
              <RevealItem>
                <div>
                  <div className="mb-3 font-manrope text-[11.5px] font-bold tracking-[.12em] text-ink-faint uppercase">
                    {svcp.procTitle}
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {cat.proc.map((step, idx) => (
                      <div key={step} className="flex items-center gap-2.5 text-[14.5px] text-ink">
                        <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-canvas font-manrope text-[11px] font-bold text-mint-deep">
                          {idx + 1}
                        </span>
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
              </RevealItem>
            </RevealGroup>

            <Reveal
              delay={0.1}
              className="mt-[clamp(24px,3vw,34px)] flex items-center justify-between gap-4 rounded-2xl bg-canvas px-5 py-4"
            >
              <div>
                <div className="mb-1 font-manrope text-[11px] font-bold tracking-[.1em] text-ink-faint uppercase">
                  {svcp.relatedLabel}
                </div>
                <div className="text-[15px] font-medium">
                  {cat.relatedName} <span className="text-ink-soft">— {cat.relatedCat}</span>
                </div>
              </div>
              <button
                onClick={() => router.push(`/${lang}/work/${relatedSlugs[i]}`)}
                className="flex-none cursor-pointer text-[14px] font-semibold text-dark underline decoration-mint decoration-[1.5px] underline-offset-4"
              >
                {t.work.cta}
              </button>
            </Reveal>
          </Reveal>
        </section>
      ))}

      <section className="mx-auto mt-[clamp(56px,7vw,96px)] max-w-[1280px] px-5 pb-[clamp(60px,8vw,100px)] sm:px-6">
        <Reveal className="mx-auto max-w-[64ch] text-center text-[14.5px] leading-[1.8] text-ink-soft">
          {svcp.note}
        </Reveal>
      </section>
    </>
  );
}
