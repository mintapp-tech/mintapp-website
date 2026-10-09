import { FOUNDATIONS as F, type Frame } from "@/lib/pack/foundations";
import { PATTERNS, type PatternId } from "@/lib/pack/patterns";
import type { DesignArtifact } from "@/lib/pack/schema";
import { TEMPLATE_COMPONENTS } from "./templates";

// The internal preview of an initial design: each screen drawn by its trusted
// template inside a device frame, the user flow, and the reasoning behind it. The
// design's own language decides its direction (an Arabic design mirrors); the
// surrounding labels follow the interface language.

export interface DesignLabels {
  pattern: string;
  audience: string;
  goal: string;
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

function DeviceFrame({ frame, label, children, dir }: { frame: Frame; label: string; children: React.ReactNode; dir: "ltr" | "rtl" }) {
  return (
    <figure className="m-0 min-w-0">
      <figcaption className="mb-2 text-[12px] font-semibold text-ink-soft">{label}</figcaption>
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

export default function DesignPreview({ design, labels, locale }: { design: DesignArtifact; labels: DesignLabels; locale: "en" | "ar" }) {
  const pattern = PATTERNS[design.blueprint.pattern as PatternId];
  const dir = design.language === "ar" ? "rtl" : "ltr";
  const mobile = pattern.kind === "mobile_app";
  const screenIndex = new Map(design.screens.map((s, i) => [s.id, i + 1]));

  return (
    <div className="space-y-6" data-design-preview data-pattern={design.blueprint.pattern}>
      <p className="m-0 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13.5px] font-medium text-amber-950">{labels.notFinal}</p>
      <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-3 text-[14px] sm:grid-cols-2">
        <div>
          <dt className="text-[12.5px] font-semibold text-ink-soft">{labels.pattern}</dt>
          <dd className="m-0">{pattern[locale]}</dd>
        </div>
        <div>
          <dt className="text-[12.5px] font-semibold text-ink-soft">{labels.audience}</dt>
          <dd dir="auto" className="m-0">
            {design.blueprint.audience}
          </dd>
        </div>
        <div>
          <dt className="text-[12.5px] font-semibold text-ink-soft">{labels.goal}</dt>
          <dd dir="auto" className="m-0">
            {design.blueprint.primary_goal}
          </dd>
        </div>
        <div>
          <dt className="text-[12.5px] font-semibold text-ink-soft">{labels.brand}</dt>
          <dd dir="auto" className="m-0">
            {design.blueprint.brand_context}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[12.5px] font-semibold text-ink-soft">{labels.hierarchy}</dt>
          <dd className="m-0">
            <ol dir="auto" className="m-0 list-decimal ps-5">
              {design.blueprint.hierarchy.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ol>
          </dd>
        </div>
        {design.blueprint.responsive_notes && (
          <div className="sm:col-span-2">
            <dt className="text-[12.5px] font-semibold text-ink-soft">{labels.responsive}</dt>
            <dd dir="auto" className="m-0">
              {design.blueprint.responsive_notes}
            </dd>
          </div>
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
          const Template = TEMPLATE_COMPONENTS[screen.template as keyof typeof TEMPLATE_COMPONENTS];
          const n = i + 1;
          return (
            <section key={screen.id} aria-label={`${labels.screen(n)}: ${screen.title}`} data-screen={screen.template} className="min-w-0 space-y-3">
              <div>
                <h3 dir="auto" className="m-0 text-[15px] font-semibold">
                  {labels.screen(n)} · {screen.title}
                </h3>
                <p dir="auto" className="m-0 text-[13px] text-ink-soft">
                  {screen.purpose}
                </p>
              </div>
              {mobile ? (
                <DeviceFrame frame="phone" label={labels.phone} dir={dir}>
                  <Template screen={screen} frame="phone" placeholder={labels.placeholder} />
                </DeviceFrame>
              ) : (
                <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
                  <DeviceFrame frame="desktop" label={labels.desktop} dir={dir}>
                    <Template screen={screen} frame="desktop" placeholder={labels.placeholder} />
                  </DeviceFrame>
                  <DeviceFrame frame="phone" label={labels.phone} dir={dir}>
                    <Template screen={screen} frame="phone" placeholder={labels.placeholder} />
                  </DeviceFrame>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
