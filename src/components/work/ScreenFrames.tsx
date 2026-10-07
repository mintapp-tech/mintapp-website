"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useLanguage } from "@/lib/language-context";
import { WORK_SCREENS, type PendingProject, type ScreenAsset } from "@/content/work-screens";
import { Reveal, RevealGroup, RevealItem } from "@/components/Reveal";

// The same dark device frame the real Rentop and Jameel screenshots use.
function DeviceFrame({ asset, sizes, priority }: { asset: ScreenAsset; sizes: string; priority?: boolean }) {
  const { lang } = useLanguage();
  return (
    <div className="w-full overflow-hidden rounded-[28px] bg-[#0A0D0C] p-2 shadow-[0_40px_70px_-30px_rgba(0,0,0,.55)]" style={{ aspectRatio: `${asset.width} / ${asset.height}` }}>
      <div className="relative h-full w-full overflow-hidden rounded-[20px]">
        <Image src={asset.src} alt={asset.alt[lang]} fill sizes={sizes} className="object-cover" priority={priority} />
      </div>
    </div>
  );
}

// Homepage card visual: the approved cover screenshot when there is one,
// otherwise the existing composition passed as children.
export function CardCover({ slug, children }: { slug: PendingProject; children: ReactNode }) {
  const cover = WORK_SCREENS[slug].cover;
  if (!cover) return <>{children}</>;
  return (
    <div className="relative w-[132px]">
      <DeviceFrame asset={cover} sizes="132px" />
    </div>
  );
}

// Case-study "Product screens": real screenshots in device frames when they
// exist, otherwise the existing title, copy and composition (children).
export function ProductScreens({ slug, title, copy, children }: { slug: PendingProject; title: string; copy: string; children: ReactNode }) {
  const { lang } = useLanguage();
  const work = WORK_SCREENS[slug];
  const real = work.screens.length > 0;
  return (
    <>
      <Reveal className="mb-3 font-manrope text-[12.5px] font-bold tracking-[.14em] text-mint-deep uppercase">{title}</Reveal>
      <Reveal delay={0.05} className="mb-[clamp(24px,3vw,36px)] max-w-[60ch] text-[16px] leading-[1.85] text-ink-soft">
        {real && work.intro ? work.intro[lang] : copy}
      </Reveal>
      {real ? (
        <RevealGroup className="grid grid-cols-2 gap-[clamp(14px,2vw,24px)] sm:grid-cols-4">
          {work.screens.map((asset, i) => (
            <RevealItem key={asset.src}>
              <DeviceFrame asset={asset} sizes="(min-width: 1024px) 25vw, 45vw" priority={i === 0} />
            </RevealItem>
          ))}
        </RevealGroup>
      ) : (
        children
      )}
    </>
  );
}
