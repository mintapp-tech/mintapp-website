"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useLanguage } from "@/lib/language-context";
import { WORK_SCREENS, type ScreenProject, type ScreenAsset } from "@/content/work-screens";
import { Reveal, RevealGroup, RevealItem } from "@/components/Reveal";

const isWide = (asset: ScreenAsset) => asset.width > asset.height;

// The same dark device frame the real Rentop and Jameel screenshots use;
// website and desktop screens get a tighter, browser-like corner.
function DeviceFrame({ asset, sizes, priority }: { asset: ScreenAsset; sizes: string; priority?: boolean }) {
  const { lang } = useLanguage();
  const wide = isWide(asset);
  return (
    <div
      className={`w-full overflow-hidden bg-[#0A0D0C] shadow-[0_40px_70px_-30px_rgba(0,0,0,.55)] ${wide ? "rounded-[14px] p-1.5" : "rounded-[28px] p-2"}`}
      style={{ aspectRatio: `${asset.width} / ${asset.height}` }}
    >
      <div className={`relative h-full w-full overflow-hidden ${wide ? "rounded-[9px]" : "rounded-[20px]"}`}>
        <Image src={asset.src} alt={asset.alt[lang]} fill sizes={sizes} className="object-cover object-top" priority={priority} />
      </div>
    </div>
  );
}

// Homepage card visual: the approved cover screenshot when there is one,
// otherwise the existing composition passed as children.
export function CardCover({ slug, children }: { slug: ScreenProject; children?: ReactNode }) {
  const cover = WORK_SCREENS[slug].cover;
  if (!cover) return <>{children}</>;
  const wide = isWide(cover);
  return (
    <div className={`relative ${wide ? "w-[min(100%,300px)]" : "w-[132px]"}`}>
      <DeviceFrame asset={cover} sizes={wide ? "300px" : "132px"} />
    </div>
  );
}

// Case-study hero visual: the cover screenshot when there is one, otherwise
// the existing composition passed as children.
export function HeroScreen({ slug, children }: { slug: ScreenProject; children?: ReactNode }) {
  const cover = WORK_SCREENS[slug].cover;
  if (!cover) return <>{children}</>;
  return (
    <div className={`relative ${isWide(cover) ? "w-[min(100%,820px)]" : "w-[min(48%,270px)]"}`}>
      <DeviceFrame asset={cover} sizes="(min-width: 1024px) 820px, 90vw" priority />
    </div>
  );
}

// Case-study "Product screens": real screenshots in device frames when they
// exist, otherwise the existing title, copy and composition (children).
export function ProductScreens({ slug, title, copy, children }: { slug: ScreenProject; title: string; copy: string; children?: ReactNode }) {
  const { lang } = useLanguage();
  const work = WORK_SCREENS[slug];
  const real = work.screens.length > 0;
  const wide = real && isWide(work.screens[0]);
  return (
    <>
      <Reveal className="mb-3 font-manrope text-[12.5px] font-bold tracking-[.14em] text-mint-deep uppercase">{title}</Reveal>
      <Reveal delay={0.05} className="mb-[clamp(24px,3vw,36px)] max-w-[60ch] text-[16px] leading-[1.85] text-ink-soft">
        {real && work.intro ? work.intro[lang] : copy}
      </Reveal>
      {real ? (
        <RevealGroup className={`grid gap-[clamp(14px,2vw,24px)] ${wide ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
          {work.screens.map((asset, i) => (
            <RevealItem key={asset.src}>
              <DeviceFrame asset={asset} sizes={wide ? "(min-width: 640px) 50vw, 95vw" : "(min-width: 1024px) 25vw, 45vw"} priority={i === 0} />
            </RevealItem>
          ))}
        </RevealGroup>
      ) : (
        children
      )}
    </>
  );
}
