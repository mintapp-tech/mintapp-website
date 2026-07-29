"use client";

import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/language-context";
import { Reveal } from "./Reveal";
import { SplitReveal } from "./motion/SplitReveal";
import { Magnetic } from "./motion/Magnetic";

export default function FinalCta() {
  const { t } = useLanguage();
  const router = useRouter();

  return (
    <section className="px-5 pt-[clamp(60px,8vw,120px)] sm:px-6">
      <Reveal className="relative mx-auto max-w-[1280px] overflow-hidden rounded-[24px] bg-dark p-[clamp(40px,7vw,110px)] px-[clamp(26px,5vw,80px)] text-canvas">
        <span className="absolute -end-[90px] -top-[90px] block h-[320px] w-[320px] rounded-full bg-mint/10" />
        <span className="absolute end-[24%] -bottom-10 block h-[120px] w-[120px] rounded-[30px] border-[1.5px] border-mint/35" />
        <div className="relative max-w-[22ch]">
          <SplitReveal
            as="h2"
            text={t.final.title}
            className="m-0 text-[clamp(32px,4.6vw,64px)] leading-[1.14] font-semibold tracking-[-0.025em] text-canvas text-balance"
          />
          <p className="mt-[22px] mb-[34px] max-w-[40ch] text-[clamp(16.5px,1.4vw,19px)] leading-[1.85] text-canvas/72">
            {t.final.sub}
          </p>
          <div className="flex flex-wrap gap-3">
            <Magnetic className="inline-block">
              <button
                onClick={() => router.push("/start")}
                className="cursor-pointer rounded-full border-0 bg-mint px-8 py-[17px] text-[16.5px] font-bold text-dark transition-colors hover:bg-mint-soft"
              >
                {t.final.cta}
              </button>
            </Magnetic>
            <a
              href="mailto:hello@mintapp.tech"
              className="rounded-full border border-canvas/28 px-8 py-[17px] text-[16.5px] font-semibold text-canvas transition-colors hover:border-mint hover:bg-canvas/[.06]"
            >
              hello@mintapp.tech
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
