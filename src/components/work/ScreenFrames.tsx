"use client";

import type { ReactNode } from "react";
import { useLanguage } from "@/lib/language-context";
import { WORK_SCREENS, type ScreenProject, type ScreenAsset } from "@/content/work-screens";
import { Reveal, RevealGroup, RevealItem } from "@/components/Reveal";
import { BrowserMockup, PhoneMockup } from "./Mockups";

function Shot({ asset, sizes, priority, hint }: { asset: ScreenAsset; sizes: string; priority?: boolean; hint?: boolean }) {
  const { lang } = useLanguage();
  const props = { src: asset.src, alt: asset.alt[lang], width: asset.width, height: asset.height, sizes, priority };
  return asset.frame === "browser" ? <BrowserMockup {...props} label={asset.label} hint={hint} /> : <PhoneMockup {...props} />;
}

// Homepage card visual: the approved cover screenshot when there is one,
// otherwise the existing composition passed as children.
export function CardCover({ slug, children }: { slug: ScreenProject; children?: ReactNode }) {
  const cover = WORK_SCREENS[slug].cover;
  if (!cover) return <>{children}</>;
  const browser = cover.frame === "browser";
  return (
    <div className={`relative ${browser ? "w-[min(100%,300px)]" : "w-[132px]"}`}>
      <Shot asset={cover} sizes={browser ? "300px" : "132px"} hint={false} />
    </div>
  );
}

// Case-study hero: phones fan out the cover between two more screens;
// a website or desktop app gets one large window. Falls back to the
// existing composition (children) when there are no screens.
export function HeroScreen({ slug, children }: { slug: ScreenProject; children?: ReactNode }) {
  const { cover, screens } = WORK_SCREENS[slug];
  if (!cover) return <>{children}</>;
  if (cover.frame === "browser") {
    return (
      <div className="relative w-[min(100%,900px)]">
        <Shot asset={cover} sizes="(min-width: 1024px) 900px, 92vw" priority />
      </div>
    );
  }
  const [left, right] = screens.filter((s) => s.src !== cover.src);
  return (
    <div className="relative flex w-full items-center justify-center">
      {left && (
        <div className="relative z-0 -me-[6%] w-[min(30%,220px)] translate-y-[7%] -rotate-[7deg]">
          <Shot asset={left} sizes="220px" />
        </div>
      )}
      <div className="relative z-10 w-[min(38%,280px)]">
        <Shot asset={cover} sizes="280px" priority />
      </div>
      {right && (
        <div className="relative z-0 -ms-[6%] w-[min(30%,220px)] translate-y-[7%] rotate-[7deg]">
          <Shot asset={right} sizes="220px" />
        </div>
      )}
    </div>
  );
}

// Case-study "Product screens": real screenshots in device mockups when
// they exist, otherwise the existing title, copy and composition (children).
export function ProductScreens({ slug, title, copy, children }: { slug: ScreenProject; title: string; copy: string; children?: ReactNode }) {
  const { lang } = useLanguage();
  const work = WORK_SCREENS[slug];
  const real = work.screens.length > 0;
  const browser = real && work.screens[0].frame === "browser";
  return (
    <>
      <Reveal className="mb-3 font-manrope text-[12.5px] font-bold tracking-[.14em] text-mint-deep uppercase">{title}</Reveal>
      <Reveal delay={0.05} className="mb-[clamp(24px,3vw,36px)] max-w-[60ch] text-[16px] leading-[1.85] text-ink-soft">
        {real && work.intro ? work.intro[lang] : copy}
      </Reveal>
      {real ? (
        <RevealGroup className={`grid ${browser ? "grid-cols-1 gap-[clamp(20px,3vw,40px)] md:grid-cols-2" : "grid-cols-2 gap-x-[clamp(16px,3vw,40px)] gap-y-[clamp(28px,4vw,48px)] lg:grid-cols-4"}`}>
          {work.screens.map((asset, i) => (
            <RevealItem key={asset.src}>
              <Shot asset={asset} sizes={browser ? "(min-width: 768px) 50vw, 95vw" : "(min-width: 1024px) 25vw, 45vw"} priority={i === 0} />
            </RevealItem>
          ))}
        </RevealGroup>
      ) : (
        children
      )}
    </>
  );
}
