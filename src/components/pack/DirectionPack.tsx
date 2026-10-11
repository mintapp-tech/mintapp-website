import { LogoMark } from "@/components/Logo";
import { ScreenInFrame } from "@/components/pack/DesignPreview";
import { patternInfo } from "@/lib/pack/library";
import { PRESENTATION_COPY } from "@/lib/pack/presentation-copy";
import type { DirectionPackSource } from "@/lib/pack/presentation";
import { buildSlides, type Slide, type SlideColumn } from "@/lib/pack/slides";
import DeckControls, { type DeckLabels } from "./DeckControls";

// The Direction Pack: the client presentation for the first meeting, drawn only by
// these trusted components from one validated Pack (text is rendered as text; no
// markup, style or asset comes from the Pack). Slides are a fixed 1280 x 720 stage,
// scaled to the window (DeckControls), printed one per page at 16:9 or on A4, and
// reflowed into a reading column on phones. There is no animation, so reduced
// motion needs nothing.

export interface CoverInfo {
  // The client's company, or their name when there is no company.
  name: string;
  projectType: string | null;
  // The day the last part was approved, in the Pack's language (approved mode).
  approvedDay: string | null;
}

const CSS = `
.dp-root{--dp-scale:.7;min-height:100vh;background:#e7ebe8;color:#1d2420}
.dp-toolbar{position:sticky;top:0;z-index:20}
.dp-deck{display:flex;flex-direction:column;align-items:center;gap:28px;padding:28px 16px 64px}
.dp-slide{zoom:var(--dp-scale);position:relative;flex:none;width:1280px;height:720px;overflow:hidden;background:#fbfbf9;border-radius:8px;box-shadow:0 12px 36px rgba(20,30,25,.16);scroll-margin-top:72px}
.dp-stage{position:absolute;inset:0;display:flex;flex-direction:column;padding:52px 64px 40px}
.dp-head{flex:none;margin-bottom:26px}
.dp-kicker{font-size:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#1f6f5c}
.dp-deck[lang=ar] .dp-kicker{letter-spacing:0;text-transform:none}
.dp-title{margin:6px 0 0;font-size:40px;line-height:1.15;font-weight:700;letter-spacing:-.01em}
.dp-deck[lang=ar] .dp-title{letter-spacing:0;line-height:1.35}
.dp-body{flex:1;min-height:0;overflow:hidden}
.dp-cols{display:grid;gap:48px;height:100%}
.dp-cols[data-n="1"]{grid-template-columns:minmax(0,1fr)}
.dp-cols[data-n="2"]{grid-template-columns:repeat(2,minmax(0,1fr))}
.dp-cols[data-n="3"]{grid-template-columns:repeat(3,minmax(0,1fr));gap:36px}
.dp-col h3{margin:0 0 12px;font-size:16px;font-weight:700;color:#5a635e}
.dp-list{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:14px}
.dp-item{position:relative;padding-inline-start:22px;font-size:19px;line-height:1.5}
.dp-deck[lang=ar] .dp-item{line-height:1.75}
.dp-item::before{content:"";position:absolute;inset-inline-start:2px;top:.65em;width:8px;height:8px;border-radius:9999px;background:#1f6f5c}
.dp-list[data-numbered] .dp-item::before{display:none}
.dp-num{position:absolute;inset-inline-start:0;top:0;font-weight:700;color:#1f6f5c;font-size:17px}
.dp-note{display:block;margin-top:2px;font-size:15px;line-height:1.45;color:#5a635e}
.dp-tag{display:inline-block;margin-bottom:2px;border-radius:9999px;padding:1px 9px;font-size:12.5px;font-weight:700}
.dp-tag[data-tag=client_fact]{background:#e3f1ec;color:#1b5c4c}
.dp-tag[data-tag=assumption]{background:#fbf0d9;color:#7a4b06}
.dp-banner{flex:none;margin:-10px 0 18px;border-radius:10px;background:#fbf0d9;color:#5e3b05;padding:10px 16px;font-size:15px;font-weight:600}
.dp-foot{position:absolute;inset-inline:64px;bottom:18px;display:flex;justify-content:space-between;font-size:12.5px;color:#7a837e}
.dp-watermark{position:absolute;top:14px;inset-inline-end:18px;border-radius:9999px;background:#fde8e6;color:#8f2418;padding:4px 12px;font-size:12.5px;font-weight:700}
.dp-frames{display:flex;align-items:flex-start;gap:28px;justify-content:flex-end}
.dp-frame-desktop{zoom:.62;width:1040px;flex:none}
.dp-frame-phone{zoom:.62;width:340px;flex:none}
.dp-mobile .dp-frame-phone{zoom:.66}
.dp-print-blocked{display:none}
@media (max-width:699px){
 .dp-deck{padding:16px 16px 48px;gap:16px}
 .dp-slide{zoom:1;width:100%;height:auto;overflow:visible}
 .dp-stage{position:static;padding:22px 18px 46px}
 .dp-title{font-size:26px}
 .dp-cols,.dp-cols[data-n]{grid-template-columns:minmax(0,1fr);gap:22px;height:auto}
 .dp-body{overflow:visible}
 .dp-item{font-size:16px}
 .dp-frames{flex-direction:column;align-items:stretch}
 .dp-frame-desktop{display:none}
 .dp-frame-phone,.dp-mobile .dp-frame-phone{zoom:1;width:100%}
 .dp-cover-title{font-size:34px!important}
 .dp-split{grid-template-columns:minmax(0,1fr)!important}
}
@page{size:1280px 720px;margin:0}
@media print{
 html,body{background:#fff!important}
 .dp-root{background:#fff}
 .dp-toolbar{display:none!important}
 .dp-deck{display:block;padding:0}
 .dp-slide{zoom:1!important;width:1280px!important;height:720px!important;overflow:hidden!important;border-radius:0;box-shadow:none;break-after:page;margin:0}
 .dp-stage{position:absolute!important;padding:52px 64px 40px!important}
 .dp-root[data-print=a4] .dp-slide{zoom:.84!important;margin:46px auto 0}
 .dp-root[data-mode=preview] .dp-deck{display:none}
 .dp-root[data-mode=preview] .dp-print-blocked{display:block;padding:40px;font-size:18px}
}
`;

function Head({ kicker, title }: { kicker: string; title: string }) {
  return (
    <header className="dp-head">
      <p className="dp-kicker m-0">{kicker}</p>
      <h2 className="dp-title">{title}</h2>
    </header>
  );
}

function Column({ column, tagLabels }: { column: SlideColumn; tagLabels: { client_fact: string; assumption: string } }) {
  return (
    <div className="dp-col min-w-0">
      {column.heading && <h3>{column.heading}</h3>}
      <ol className="dp-list" data-numbered={column.numbered ? "" : undefined}>
        {column.items.map((item, i) => (
          <li key={i} className="dp-item">
            {column.numbered && (
              <span aria-hidden className="dp-num">
                {(column.start ?? 1) + i}
              </span>
            )}
            {item.tag && (
              <span className="dp-tag" data-tag={item.tag}>
                {tagLabels[item.tag]}
              </span>
            )}
            <span className="block">
              {item.label && <strong>{item.label}: </strong>}
              {item.text}
            </span>
            {item.note && <span className="dp-note">{item.note}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function DirectionPack({ source, cover, ui }: { source: DirectionPackSource; cover: CoverInfo; ui: DeckLabels & { back: string; previewBanner: string; printBlocked: string } }) {
  const { pack, versions, mode } = source;
  const lang = pack.language;
  const c = PRESENTATION_COPY[lang];
  const slides: Slide[] = buildSlides(pack);
  const version = c.version(versions.design, versions.proposal, versions.discovery);
  const info = pack.design_blueprint.pattern ? patternInfo(pack.design_blueprint.pattern) : null;
  const kind = info?.kind ?? (cover.projectType && cover.projectType in c.projectKinds ? (cover.projectType as "website") : "web_app");
  const tagLabels = { client_fact: c.labels.clientSaid, assumption: c.labels.assumption };
  const total = slides.length;

  const body = (slide: Slide, n: number) => {
    const kicker = `${n} / ${total}`;
    switch (slide.kind) {
      case "cover":
        return (
          <div className="flex h-full flex-col justify-between">
            <div className="flex items-center gap-3">
              <LogoMark size={40} />
              <span className="text-[20px] font-bold">{c.brand}</span>
            </div>
            <div className="max-w-[900px]">
              <p className="dp-kicker m-0">{c.title}</p>
              <h1 className="dp-cover-title mt-3 mb-0 text-[64px] leading-[1.1] font-bold">
                <bdi>{cover.name}</bdi>
              </h1>
              <p className="mt-4 mb-0 text-[24px] text-[#5a635e]">{c.projectKinds[kind]}</p>
              <p className="mt-8 mb-0 max-w-[760px] text-[19px] leading-relaxed">{c.initialDirection}</p>
            </div>
            <p className="m-0 text-[14px] text-[#5a635e]">
              {version}
              {mode === "approved" && cover.approvedDay ? ` · ${c.approvedOn(cover.approvedDay)}` : ""}
            </p>
          </div>
        );
      case "columns":
        return (
          <>
            <Head kicker={kicker} title={slide.continued ? `${slide.title} (${c.continued})` : slide.title} />
            {slide.banner && <p className="dp-banner">{c.notFinal}</p>}
            <div className="dp-body">
              {slide.columns.length ? (
                <div className="dp-cols" data-n={Math.min(slide.columns.length, 3)}>
                  {slide.columns.map((col, i) => (
                    <Column key={i} column={col} tagLabels={tagLabels} />
                  ))}
                </div>
              ) : (
                <p className="m-0 text-[20px] text-[#5a635e]">{slide.empty}</p>
              )}
            </div>
          </>
        );
      case "direction":
        return (
          <>
            <Head kicker={kicker} title={slide.title} />
            <div className="dp-body">
              <div className="dp-split grid h-full grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-12">
                <div className="min-w-0">
                  {slide.pattern && <p className="dp-tag m-0 mb-3 bg-[#e3f1ec] text-[#1b5c4c]">{`${c.labels.pattern}: ${slide.pattern}`}</p>}
                  <p className="m-0 text-[25px] leading-[1.45] font-semibold">{slide.direction}</p>
                  <p className="mt-6 mb-0 text-[15px] font-bold text-[#5a635e]">{c.labels.responsive}</p>
                  <p className="m-0 text-[17px] leading-relaxed">{slide.responsive}</p>
                </div>
                <div className="min-w-0">
                  <h3 className="m-0 mb-3 text-[16px] font-bold text-[#5a635e]">{c.labels.hierarchy}</h3>
                  <ol className="dp-list" data-numbered="">
                    {slide.hierarchy.map((h, i) => (
                      <li key={i} className="dp-item">
                        <span aria-hidden className="dp-num">
                          {i + 1}
                        </span>
                        {h}
                      </li>
                    ))}
                  </ol>
                  <p className="mt-5 mb-0 text-[15px] font-bold text-[#5a635e]">{c.labels.brand}</p>
                  <p className="m-0 text-[16px] leading-relaxed">{slide.brand}</p>
                </div>
              </div>
            </div>
          </>
        );
      case "screen": {
        const s = slide.screen;
        return (
          <>
            <Head kicker={kicker} title={slide.title} />
            <div className="dp-body">
              <div className={`dp-split grid h-full gap-10 ${kind === "mobile_app" ? "dp-mobile grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]" : "grid-cols-[300px_minmax(0,1fr)]"}`}>
                <div className="min-w-0">
                  <p className="m-0 text-[24px] leading-snug font-bold">{s.title}</p>
                  <p className="mt-3 mb-0 text-[15px] font-bold text-[#5a635e]">{c.labels.screenPurpose}</p>
                  <p className="m-0 text-[17px] leading-relaxed">{s.purpose}</p>
                  <p className="mt-6 mb-0 text-[13.5px] text-[#5a635e]">{c.conceptNote}</p>
                </div>
                <div className="dp-frames min-w-0" aria-label={s.title}>
                  {kind !== "mobile_app" && (
                    <div className="dp-frame-desktop">
                      <ScreenInFrame design={{ kind, language: lang }} screen={s} frame="desktop" placeholder={c.labels.placeholder} label={c.labels.desktop} />
                    </div>
                  )}
                  <div className="dp-frame-phone">
                    <ScreenInFrame design={{ kind, language: lang }} screen={s} frame="phone" placeholder={c.labels.placeholder} label={c.labels.phone} />
                  </div>
                </div>
              </div>
            </div>
          </>
        );
      }
    }
  };

  return (
    <div className="dp-root" data-mode={mode}>
      <style>{CSS}</style>
      <DeckControls total={total} mode={mode} labels={ui} dir={lang === "ar" ? "rtl" : "ltr"} />
      <main className="dp-deck" dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} aria-label={c.title} data-direction-pack data-pack-version={`${versions.design}.${versions.proposal}.${versions.discovery}`}>
        {slides.map((slide, i) => (
          <section key={i} id={`slide-${i + 1}`} className="dp-slide" aria-roledescription="slide" aria-label={`${i + 1} / ${total}`} data-slide={slide.kind}>
            <div className="dp-stage">
              {body(slide, i + 1)}
              {i > 0 && (
                <footer className="dp-foot">
                  <span>{c.footer(version)}</span>
                  <span>{`${i + 1} / ${total}`}</span>
                </footer>
              )}
              {mode === "preview" && <p className="dp-watermark m-0">{ui.previewBanner}</p>}
            </div>
          </section>
        ))}
      </main>
      <p className="dp-print-blocked">{ui.printBlocked}</p>
    </div>
  );
}
