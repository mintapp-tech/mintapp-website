import { FOUNDATIONS as F, type Frame } from "@/lib/pack/library";
import type { DesignView } from "@/lib/pack/schema";
import { TEMPLATE_COMPONENTS, type Screen } from "./templates";

// The internal preview of a concept design: each screen drawn by its trusted
// template inside a device frame, the user flow, and the reasoning behind it. The
// design's own language decides its direction (an Arabic design mirrors); the
// surrounding labels follow the interface language. ScreenInFrame is shared with
// the Direction Pack.

export interface DesignLabels {
  pattern: string;
  audience: string;
  goal: string;
  direction: string;
  hierarchy: string;
  responsive: string;
  brand: string;
  flow: string;
  screen: (n: number) => string;
  desktop: string;
  phone: string;
  placeholder: string;
  notFinal: string;
}

const isWebsite = (design: Pick<DesignView, "kind">) => design.kind === "website";

// A website's top bar (navigation): the brand slot and three destinations, decorative.
function SiteNav({ frame }: { frame: Frame }) {
  return (
    <div aria-hidden className={`flex items-center justify-between border-b px-5 py-3 ${F.colour.line} ${F.colour.panel}`}>
      <span className={`h-3 w-16 ${F.radius.pill} ${F.colour.accent}`} />
      {frame === "desktop" ? (
        <span className="flex gap-3">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`h-2.5 w-12 ${F.radius.pill} ${F.colour.placeholder}`} />
          ))}
        </span>
      ) : (
        <span className="flex flex-col gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="block h-0.5 w-4 rounded bg-[#5a635e]" />
          ))}
        </span>
      )}
    </div>
  );
}

// A phone app's bottom tab bar (mobile navigation), decorative.
function MobileTabBar() {
  return (
    <div aria-hidden className={`grid grid-cols-4 gap-2 border-t px-4 py-2.5 ${F.colour.line} ${F.colour.panel}`}>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="flex flex-col items-center gap-1">
          <span className={`size-4 ${F.radius.control} ${i === 0 ? F.colour.accent : F.colour.placeholder}`} />
          <span className={`h-1.5 w-8 ${F.radius.pill} ${F.colour.placeholder}`} />
        </span>
      ))}
    </div>
  );
}

export function DeviceFrame({ frame, label, children, dir }: { frame: Frame; label?: string; children: React.ReactNode; dir: "ltr" | "rtl" }) {
  return (
    <figure className="m-0 min-w-0">
      {label && <figcaption className="mb-2 text-[12px] font-semibold text-ink-soft">{label}</figcaption>}
      <div
        dir={dir}
        lang={dir === "rtl" ? "ar" : "en"}
        className={`overflow-hidden border ${F.colour.line} ${F.colour.page} ${F.radius.frame} ${F.shadow.frame} ${frame === "phone" ? "mx-auto w-full max-w-[340px]" : "w-full"}`}
      >
        {frame === "desktop" ? (
          <div aria-hidden className="flex gap-1.5 border-b border-[#e2e6e3] bg-white px-3 py-2">
            <span className="size-2 rounded-full bg-[#d6dbd8]" />
            <span className="size-2 rounded-full bg-[#d6dbd8]" />
            <span className="size-2 rounded-full bg-[#d6dbd8]" />
          </div>
        ) : (
          <div aria-hidden className="mx-auto my-2 h-1.5 w-16 rounded-full bg-[#d6dbd8]" />
        )}
        {children}
      </div>
    </figure>
  );
}

// One screen in one frame, with the navigation its kind of product has.
export function ScreenInFrame({ design, screen, frame, placeholder, label }: { design: Pick<DesignView, "kind" | "language">; screen: Screen; frame: Frame; placeholder: string; label?: string }) {
  const Template = TEMPLATE_COMPONENTS[screen.template as keyof typeof TEMPLATE_COMPONENTS];
  const dir = design.language === "ar" ? "rtl" : "ltr";
  return (
    <DeviceFrame frame={frame} label={label} dir={dir}>
      {isWebsite(design) && <SiteNav frame={frame} />}
      <Template screen={screen} frame={frame} placeholder={placeholder} />
      {design.kind === "mobile_app" && <MobileTabBar />}
    </DeviceFrame>
  );
}

function Note({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-[12.5px] font-semibold text-ink-soft">{label}</dt>
      <dd dir="auto" className="m-0">
        {children}
      </dd>
    </div>
  );
}

export default function DesignPreview({ design, labels, locale }: { design: DesignView; labels: DesignLabels; locale: "en" | "ar" }) {
  const mobile = design.kind === "mobile_app";
  const screenIndex = new Map(design.screens.map((s, i) => [s.id, i + 1]));
  const n = design.notes;

  return (
    <div className="space-y-6" data-design-preview data-pattern={design.pattern}>
      <p className="m-0 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13.5px] font-medium text-amber-950">{labels.notFinal}</p>
      <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-3 text-[14px] sm:grid-cols-2">
        <Note label={labels.pattern}>{design.name[locale]}</Note>
        {n.direction && <Note label={labels.direction}>{n.direction}</Note>}
        {n.audience && <Note label={labels.audience}>{n.audience}</Note>}
        {n.goal && <Note label={labels.goal}>{n.goal}</Note>}
        <Note label={labels.brand}>{n.brand}</Note>
        <Note label={labels.hierarchy} wide>
          <ol className="m-0 list-decimal ps-5">
            {n.hierarchy.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ol>
        </Note>
        {n.responsive && (
          <Note label={labels.responsive} wide>
            {n.responsive}
          </Note>
        )}
      </dl>

      <section aria-label={labels.flow}>
        <h3 className="m-0 mb-2 text-[14px] font-semibold">{labels.flow}</h3>
        <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0 text-[13px]" data-user-flow>
          {design.user_flow.map((step, i) => (
            <li key={i} className="flex items-center gap-2">
              <span dir="auto" className="rounded-full bg-surface-2 px-3 py-1">
                <strong>{labels.screen(screenIndex.get(step.screen) ?? 0)}</strong> · {step.step}
              </span>
              {i < design.user_flow.length - 1 && (
                <span aria-hidden className="text-ink-faint rtl:-scale-x-100">
                  →
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>

      <div className={`grid gap-6 ${mobile ? "sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"}`}>
        {design.screens.map((screen, i) => {
          const num = i + 1;
          return (
            <section key={screen.id} aria-label={`${labels.screen(num)}: ${screen.title}`} data-screen={screen.template} className="min-w-0 space-y-3">
              <div>
                <h3 dir="auto" className="m-0 text-[15px] font-semibold">
                  {labels.screen(num)} · {screen.title}
                </h3>
                <p dir="auto" className="m-0 text-[13px] text-ink-soft">
                  {screen.purpose}
                </p>
              </div>
              {mobile ? (
                <ScreenInFrame design={design} screen={screen} frame="phone" placeholder={labels.placeholder} label={labels.phone} />
              ) : (
                <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
                  <ScreenInFrame design={design} screen={screen} frame="desktop" placeholder={labels.placeholder} label={labels.desktop} />
                  <ScreenInFrame design={design} screen={screen} frame="phone" placeholder={labels.placeholder} label={labels.phone} />
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
