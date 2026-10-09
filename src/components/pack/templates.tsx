import type { ReactNode } from "react";
import { FOUNDATIONS as F, type Frame } from "@/lib/pack/foundations";
import type { TemplateId } from "@/lib/pack/patterns";
import type { PackResponse } from "@/lib/pack/schema";

// The trusted screen templates of the pattern library: one React component per
// template id. They render the model's short text slots as plain text only; no
// markup, style, link or code from a model is ever interpreted. Images are
// labelled placeholders (no external or unlicensed assets).

export type Screen = PackResponse["screens"][number];
interface Props {
  screen: Screen;
  frame: Frame;
  placeholder: string;
}

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

function Placeholder({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div aria-hidden className={cx("grid place-items-center", F.colour.placeholder, F.radius.card, F.type.small, className)}>
      {label}
    </div>
  );
}

function Actions({ screen, full }: { screen: Screen; full?: boolean }) {
  if (!screen.primary_action && !screen.secondary_action) return null;
  return (
    <div className={cx("flex flex-wrap gap-2", full && "flex-col")}>
      {screen.primary_action && <span className={cx("inline-flex justify-center px-4 py-2", F.radius.control, F.colour.accent, F.type.small, "font-semibold")}>{screen.primary_action}</span>}
      {screen.secondary_action && <span className={cx("inline-flex justify-center border px-4 py-2", F.radius.control, F.colour.line, F.type.small, "font-semibold")}>{screen.secondary_action}</span>}
    </div>
  );
}

function Heading({ screen }: { screen: Screen }) {
  return (
    <div className="space-y-1.5">
      <p className={cx(F.type.display)}>{screen.headline}</p>
      {screen.supporting_text && <p className={cx(F.type.body, F.colour.muted)}>{screen.supporting_text}</p>}
    </div>
  );
}

function Cards({ screen, frame, columns = 3 }: Props & { columns?: number }) {
  const cols = frame === "phone" ? "grid-cols-1" : columns === 2 ? "grid-cols-2" : columns === 4 ? "grid-cols-4" : "grid-cols-3";
  return (
    <ul className={cx("m-0 grid list-none gap-3 p-0", cols)}>
      {screen.items.map((item, i) => (
        <li key={i} className={cx("border p-4", F.radius.card, F.colour.line, F.colour.panel, F.shadow.card)}>
          <p className={cx(F.type.title)}>{item.title}</p>
          <p className={cx("mt-1", F.type.small, F.colour.muted)}>{item.text}</p>
        </li>
      ))}
    </ul>
  );
}

function Rows({ screen }: { screen: Screen }) {
  return (
    <ul className={cx("m-0 list-none divide-y border p-0", F.radius.card, F.colour.line, F.colour.panel)}>
      {screen.items.map((item, i) => (
        <li key={i} className="flex items-start justify-between gap-3 px-4 py-3">
          <span>
            <span className={cx("block", F.type.body, "font-semibold")}>{item.title}</span>
            <span className={cx("block", F.type.small, F.colour.muted)}>{item.text}</span>
          </span>
          <span aria-hidden className={cx("mt-1 h-2 w-10 flex-none", F.radius.pill, F.colour.placeholder)} />
        </li>
      ))}
    </ul>
  );
}

function Steps({ screen }: { screen: Screen }) {
  return (
    <ol className="m-0 list-none space-y-3 p-0">
      {screen.items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden className={cx("grid size-7 flex-none place-items-center", F.radius.pill, F.colour.accent, F.type.small, "font-bold")}>
            {i + 1}
          </span>
          <span>
            <span className={cx("block", F.type.body, "font-semibold")}>{item.title}</span>
            <span className={cx("block", F.type.small, F.colour.muted)}>{item.text}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Fields({ screen }: { screen: Screen }) {
  return (
    <div className="space-y-3">
      {screen.items.map((item, i) => (
        <div key={i}>
          <p className={cx(F.type.small, "font-semibold")}>{item.title}</p>
          <div className={cx("mt-1 border px-3 py-2.5", F.radius.control, F.colour.line, F.colour.panel, F.type.small, F.colour.muted)}>{item.text}</div>
        </div>
      ))}
    </div>
  );
}

function Shell({ frame, children }: { frame: Frame; children: ReactNode }) {
  return <div className={cx(F.space.section, "space-y-5", frame === "phone" && "px-4")}>{children}</div>;
}

// ----- Website sections

const Hero = ({ screen, frame, placeholder }: Props) => (
  <Shell frame={frame}>
    <div className={cx("grid items-center gap-6", frame === "desktop" && "grid-cols-2")}>
      <div className="space-y-4">
        <Heading screen={screen} />
        <Actions screen={screen} />
      </div>
      <Placeholder label={placeholder} className="h-40" />
    </div>
    {screen.items.length > 0 && <Cards screen={screen} frame={frame} placeholder={placeholder} />}
  </Shell>
);

const Section = ({ screen, frame, placeholder, columns }: Props & { columns?: number }) => (
  <Shell frame={frame}>
    <Heading screen={screen} />
    <Cards screen={screen} frame={frame} placeholder={placeholder} columns={columns} />
    <Actions screen={screen} />
  </Shell>
);

const StepsSection = ({ screen, frame }: Props) => (
  <Shell frame={frame}>
    <Heading screen={screen} />
    <Steps screen={screen} />
    <Actions screen={screen} />
  </Shell>
);

const Catalogue = ({ screen, frame, placeholder }: Props) => (
  <Shell frame={frame}>
    <Heading screen={screen} />
    <ul className={cx("m-0 grid list-none gap-3 p-0", frame === "phone" ? "grid-cols-1" : "grid-cols-3")}>
      {screen.items.map((item, i) => (
        <li key={i} className={cx("overflow-hidden border", F.radius.card, F.colour.line, F.colour.panel)}>
          <Placeholder label={placeholder} className="h-24 rounded-none" />
          <div className="p-3">
            <p className={cx(F.type.body, "font-semibold")}>{item.title}</p>
            <p className={cx(F.type.small, F.colour.muted)}>{item.text}</p>
          </div>
        </li>
      ))}
    </ul>
    <Actions screen={screen} />
  </Shell>
);

const FormSection = ({ screen, frame }: Props) => (
  <Shell frame={frame}>
    <Heading screen={screen} />
    <div className={cx("border p-5", F.radius.card, F.colour.line, F.colour.panel, frame === "desktop" && "max-w-[460px]")}>
      <Fields screen={screen} />
      <div className="mt-4">
        <Actions screen={screen} full={frame === "phone"} />
      </div>
    </div>
  </Shell>
);

const Faq = ({ screen, frame }: Props) => (
  <Shell frame={frame}>
    <Heading screen={screen} />
    <Rows screen={screen} />
  </Shell>
);

const Cta = ({ screen, frame }: Props) => (
  <Shell frame={frame}>
    <div className={cx("space-y-4 p-6 text-center", F.radius.card, F.colour.placeholder)}>
      <Heading screen={screen} />
      <div className="flex justify-center">
        <Actions screen={screen} />
      </div>
    </div>
  </Shell>
);

// ----- Web application screens

function AppChrome({ frame, title, children }: { frame: Frame; title: string; children: ReactNode }) {
  if (frame === "phone") return <div className="space-y-4 p-4">{children}</div>;
  return (
    <div className="grid min-h-[300px] grid-cols-[140px_1fr]">
      <aside aria-hidden className={cx("space-y-2 border-e p-4", F.colour.line, F.colour.panel)}>
        <div className={cx("h-3 w-16", F.radius.pill, F.colour.accent)} />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cx("h-2.5 w-20", F.radius.pill, F.colour.placeholder)} />
        ))}
      </aside>
      <div className="space-y-4 p-5">
        <p className={cx(F.type.label, F.colour.muted)}>{title}</p>
        {children}
      </div>
    </div>
  );
}

const Dashboard = ({ screen, frame }: Props) => (
  <AppChrome frame={frame} title={screen.title}>
    <Heading screen={screen} />
    <ul className={cx("m-0 grid list-none gap-3 p-0", frame === "phone" ? "grid-cols-2" : "grid-cols-3")}>
      {screen.items.map((item, i) => (
        <li key={i} className={cx("border p-3", F.radius.card, F.colour.line, F.colour.panel)}>
          <p className={cx(F.type.small, F.colour.muted)}>{item.title}</p>
          <p aria-hidden className={cx("mt-2 h-4 w-12", F.radius.pill, F.colour.placeholder)} />
          <p className={cx("mt-2", F.type.small)}>{item.text}</p>
        </li>
      ))}
    </ul>
    <Actions screen={screen} />
  </AppChrome>
);

const Table = ({ screen, frame }: Props) => (
  <AppChrome frame={frame} title={screen.title}>
    <Heading screen={screen} />
    <Rows screen={screen} />
    <Actions screen={screen} />
  </AppChrome>
);

const Detail = ({ screen, frame, placeholder }: Props) => (
  <AppChrome frame={frame} title={screen.title}>
    <Heading screen={screen} />
    <div className={cx("grid gap-3", frame === "desktop" && "grid-cols-[2fr_1fr]")}>
      <Fields screen={screen} />
      <Placeholder label={placeholder} className="h-32" />
    </div>
    <Actions screen={screen} />
  </AppChrome>
);

const Board = ({ screen, frame }: Props) => (
  <AppChrome frame={frame} title={screen.title}>
    <Heading screen={screen} />
    <ul className={cx("m-0 grid list-none gap-3 p-0", frame === "phone" ? "grid-cols-1" : "grid-cols-4")}>
      {screen.items.map((item, i) => (
        <li key={i} className={cx("space-y-2 p-3", F.radius.card, F.colour.placeholder)}>
          <p className={cx(F.type.small, "font-semibold text-[#1d2420]")}>{item.title}</p>
          <div className={cx("border bg-white p-2", F.radius.control, F.colour.line, F.type.small)}>{item.text}</div>
        </li>
      ))}
    </ul>
  </AppChrome>
);

const Calendar = ({ screen, frame }: Props) => (
  <AppChrome frame={frame} title={screen.title}>
    <Heading screen={screen} />
    <div className={cx("grid gap-2", frame === "phone" ? "grid-cols-1" : "grid-cols-[1fr_1fr]")}>
      <div aria-hidden className={cx("grid grid-cols-7 gap-1 border p-3", F.radius.card, F.colour.line, F.colour.panel)}>
        {Array.from({ length: 28 }, (_, i) => (
          <span key={i} className={cx("h-5", F.radius.control, i % 9 === 3 ? F.colour.accent : F.colour.placeholder)} />
        ))}
      </div>
      <Rows screen={screen} />
    </div>
    <Actions screen={screen} />
  </AppChrome>
);

const AppForm = ({ screen, frame }: Props) => (
  <AppChrome frame={frame} title={screen.title}>
    <Heading screen={screen} />
    <div className={cx(frame === "desktop" && "max-w-[420px]")}>
      <Fields screen={screen} />
    </div>
    <Actions screen={screen} />
  </AppChrome>
);

// ----- Mobile screens (always drawn in a phone frame)

const MobileList = ({ screen, frame }: Props) => (
  <div className="space-y-4 p-4">
    <Heading screen={screen} />
    <div aria-hidden className={cx("h-9 border", F.radius.pill, F.colour.line, F.colour.panel)} />
    <Rows screen={screen} />
    <Actions screen={screen} full={frame === "phone"} />
  </div>
);

const MobileHome = ({ screen, frame, placeholder }: Props) => (
  <div className="space-y-4 p-4">
    <Heading screen={screen} />
    <Placeholder label={placeholder} className="h-28" />
    <Cards screen={screen} frame={frame} placeholder={placeholder} />
    <Actions screen={screen} full />
  </div>
);

const MobileOnboarding = ({ screen, placeholder }: Props) => (
  <div className="flex min-h-[420px] flex-col justify-between space-y-4 p-5 text-center">
    <Placeholder label={placeholder} className="h-40" />
    <Heading screen={screen} />
    <ul className="m-0 list-none space-y-1 p-0">
      {screen.items.map((item, i) => (
        <li key={i} className={cx(F.type.small, F.colour.muted)}>
          <span className="font-semibold text-[#1d2420]">{item.title}</span> · {item.text}
        </li>
      ))}
    </ul>
    <Actions screen={screen} full />
  </div>
);

const MobileDetail = ({ screen, placeholder }: Props) => (
  <div className="space-y-4 p-4">
    <Placeholder label={placeholder} className="h-36" />
    <Heading screen={screen} />
    <Rows screen={screen} />
    <Actions screen={screen} full />
  </div>
);

const MobileTracking = ({ screen }: Props) => (
  <div className="space-y-4 p-4">
    <Heading screen={screen} />
    <ol className="m-0 list-none space-y-0 border-s-2 p-0 ps-4" style={{ borderColor: "#1f6f5c" }}>
      {screen.items.map((item, i) => (
        <li key={i} className="relative pb-4">
          <span aria-hidden className="absolute -start-[23px] top-1 size-3 rounded-full" style={{ background: i === 0 ? "#1f6f5c" : "#cfd6d2" }} />
          <span className={cx("block", F.type.body, "font-semibold")}>{item.title}</span>
          <span className={cx("block", F.type.small, F.colour.muted)}>{item.text}</span>
        </li>
      ))}
    </ol>
    <Actions screen={screen} full />
  </div>
);

const MobileProfile = ({ screen, placeholder }: Props) => (
  <div className="space-y-4 p-4">
    <div className="flex items-center gap-3">
      <Placeholder label={placeholder} className="size-14 rounded-full" />
      <Heading screen={screen} />
    </div>
    <Rows screen={screen} />
    <Actions screen={screen} full />
  </div>
);

export const TEMPLATE_COMPONENTS: Record<TemplateId, (props: Props) => ReactNode> = {
  hero: Hero,
  value_points: (p) => <Section {...p} columns={p.screen.items.length >= 4 ? 4 : 3} />,
  services: (p) => <Section {...p} />,
  how_it_works: StepsSection,
  catalogue: Catalogue,
  course_list: Catalogue,
  booking_form: FormSection,
  proof: (p) => <Section {...p} columns={2} />,
  faq: Faq,
  contact_cta: Cta,
  overview_dashboard: Dashboard,
  record_table: Table,
  record_detail: Detail,
  workflow_board: Board,
  schedule_calendar: Calendar,
  data_form: AppForm,
  onboarding: MobileOnboarding,
  home: MobileHome,
  list_search: MobileList,
  detail: MobileDetail,
  booking_order: (p) => <FormSection {...p} frame="phone" />,
  tracking: MobileTracking,
  profile: MobileProfile,
};
