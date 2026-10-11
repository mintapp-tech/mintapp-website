import type { Metadata } from "next";
import Link from "next/link";
import { card } from "@/components/dashboard/ui";
import { PageHead, Panel } from "@/components/crm/parts";
import DesignPreview from "@/components/pack/DesignPreview";
import { requireAdmin } from "@/lib/admin/auth/state";
import { adminText } from "@/lib/admin/locale";
import { DESIGN_EXAMPLES } from "@/lib/pack/examples";
import { TEMPLATE_LABELS } from "@/lib/pack/labels";
import {
  APPROVAL_CHECKLIST,
  COMPONENTS,
  DISCOVERY_BANKS,
  DISCOVERY_BANK_IDS,
  FOUNDATION_RULES,
  PATTERNS,
  PATTERN_IDS,
  PROPOSAL_PATTERNS,
  PROPOSAL_PATTERN_IDS,
  QUALITY_RULES,
  RUBRIC,
  TEMPLATES,
  TEMPLATE_IDS,
  TEMPLATE_NOTES,
} from "@/lib/pack/library";
import { renderableDesign } from "@/lib/pack/schema";

export const dynamic = "force-dynamic";
// Internal only: never indexed.
export const metadata: Metadata = { title: "Design library", robots: { index: false, follow: false } };

const th = "px-3 py-2.5 text-start text-[12px] font-bold text-ink-soft";
const td = "px-3 py-2.5 align-top text-[13.5px]";

function Table({ label, id, min, children }: { label: string; id: string; min: number; children: React.ReactNode }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0" role="region" aria-label={label} tabIndex={0}>
      <table className="w-full border-collapse" style={{ minWidth: min }} data-table={id}>
        {children}
      </table>
    </div>
  );
}

// Mintapp's design library as the founders review it: the one system automated and
// manual preparation both use (src/lib/pack/library), with synthetic examples drawn
// by the same trusted templates as a real concept. The same content is generated
// into docs/pack-rules/ for Claude.
export default async function DesignLibraryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { locale, t } = await adminText();
  const l = t.lead.library;
  const m = t.pack.library;
  const d = t.lead.detail.design;
  const chosen = String((await searchParams).example ?? "");
  const example = DESIGN_EXAMPLES.find((e) => e.id === chosen) ?? DESIGN_EXAMPLES[0];
  const view = renderableDesign(example.design);
  const sections = [
    ["examples", m.examples],
    ["foundations", m.foundations],
    ["components", m.components],
    ["patterns", m.patterns],
    ["templates", m.templates],
    ["proposals", m.proposals],
    ["discovery", m.discovery],
    ["quality", m.quality],
    ["rubric", m.rubric],
    ["checklist", m.checklist],
    ["manual", l.manual],
  ] as const;

  return (
    <>
      <PageHead title={l.title} />
      <p className="mt-[-12px] mb-2 max-w-[72ch] text-[14px] text-ink-soft">{l.intro}</p>
      <p className="mt-0 mb-5 max-w-[72ch] text-[13px] text-ink-faint">{m.englishOnly}</p>

      <nav aria-label={m.nav} className="mb-6">
        <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-2 p-0 text-[13.5px]">
          {sections.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="font-semibold underline decoration-mint decoration-2 underline-offset-4">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex flex-col gap-6">
        <section aria-labelledby="examples" className={`${card} p-5 sm:p-6`} data-design-examples>
          <h2 id="examples" className="m-0 mb-3 text-[17px] font-bold">
            {m.examples}
          </h2>
          <nav aria-label={m.examples} className="mb-5">
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {DESIGN_EXAMPLES.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/settings/design-library?example=${e.id}#examples`}
                    aria-current={e.id === example.id ? "page" : undefined}
                    data-example={e.id}
                    className={`inline-block rounded-full border px-3.5 py-1.5 text-[13px] font-semibold ${e.id === example.id ? "border-dark bg-dark text-white" : "border-ink/15 text-ink hover:border-ink/40"}`}
                  >
                    {e.label[locale]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {view && <DesignPreview design={view} labels={{ ...d.labels, screen: d.screen }} locale={locale} />}
        </section>

        <Panel title={m.foundations} id="foundations">
          <div className="grid gap-5 md:grid-cols-2" data-foundations>
            {FOUNDATION_RULES.map((f) => (
              <section key={f.id} aria-label={f[locale]} data-foundation={f.id}>
                <h3 className="m-0 mb-1.5 text-[14.5px] font-semibold">{f[locale]}</h3>
                <ul className="m-0 list-disc space-y-1 ps-5 text-[13.5px]" dir="ltr" lang="en">
                  {f.rules.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Panel>

        <Panel title={m.components} id="components">
          <Table label={m.components} id="components" min={760}>
            <thead className="border-b border-line">
              <tr>
                {(["name", "purpose", "rules", "part"] as const).map((k) => (
                  <th key={k} scope="col" className={th}>
                    {m.componentColumns[k]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPONENTS.map((c) => (
                <tr key={c.id} className="border-t border-line" data-component={c.id}>
                  <th scope="row" className={`${td} text-start font-semibold`}>
                    {c[locale]}
                  </th>
                  <td className={td} dir="ltr" lang="en">
                    {c.purpose}
                  </td>
                  <td className={td} dir="ltr" lang="en">
                    <ul className="m-0 list-disc ps-4">
                      {c.rules.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </td>
                  <td className={td} dir="ltr">
                    <code className="text-[12.5px]">{c.part}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>

        <Panel title={m.patterns} id="patterns">
          <Table label={m.patterns} id="patterns" min={820}>
            <thead className="border-b border-line">
              <tr>
                <th scope="col" className={th}>
                  {l.columns.name}
                </th>
                <th scope="col" className={th}>
                  {l.columns.kind}
                </th>
                <th scope="col" className={th}>
                  {l.columns.use}
                </th>
                <th scope="col" className={th}>
                  {m.avoid}
                </th>
                <th scope="col" className={th}>
                  {l.columns.templates}
                </th>
              </tr>
            </thead>
            <tbody>
              {PATTERN_IDS.map((id) => {
                const p = PATTERNS[id];
                return (
                  <tr key={id} className="border-t border-line" data-pattern={id}>
                    <th scope="row" className={`${td} text-start font-semibold`}>
                      {p[locale]}
                      <code className="block text-[11.5px] font-normal text-ink-faint" dir="ltr">
                        {id}
                      </code>
                    </th>
                    <td className={td}>{l.kinds[p.kind]}</td>
                    <td className={td} dir="ltr" lang="en">
                      {p.fits}
                    </td>
                    <td className={td} dir="ltr" lang="en">
                      {p.avoid}
                    </td>
                    <td className={td}>{p.templates.map((tpl) => TEMPLATE_LABELS[locale][tpl]).join(locale === "ar" ? "، " : ", ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Panel>

        <Panel title={m.templates} id="templates">
          <Table label={m.templates} id="templates" min={720}>
            <thead className="border-b border-line">
              <tr>
                <th scope="col" className={th}>
                  {l.templateColumns.id}
                </th>
                <th scope="col" className={th}>
                  {m.draws}
                </th>
                <th scope="col" className={th}>
                  {l.templateColumns.kinds}
                </th>
                <th scope="col" className={th}>
                  {l.templateColumns.items}
                </th>
              </tr>
            </thead>
            <tbody>
              {TEMPLATE_IDS.map((id) => {
                const kinds = TEMPLATES[id].kinds as readonly string[];
                return (
                  <tr key={id} className="border-t border-line" data-template={id}>
                    <th scope="row" className={`${td} text-start font-semibold`}>
                      {TEMPLATE_LABELS[locale][id]}
                      <code className="block text-[11.5px] font-normal text-ink-faint" dir="ltr">
                        {id}
                      </code>
                    </th>
                    <td className={td} dir="ltr" lang="en">
                      {TEMPLATE_NOTES[id]}
                    </td>
                    <td className={td}>{kinds.map((k) => l.kinds[k]).join(locale === "ar" ? "، " : ", ")}</td>
                    <td className={td}>{TEMPLATES[id].maxItems}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Panel>

        <Panel title={m.proposals} id="proposals">
          <div className="grid gap-5 md:grid-cols-2" data-proposal-patterns>
            {PROPOSAL_PATTERN_IDS.map((id) => {
              const p = PROPOSAL_PATTERNS[id];
              return (
                <section key={id} aria-label={p[locale]} className="rounded-xl border border-line p-4" data-proposal-pattern={id}>
                  <h3 className="m-0 text-[15px] font-semibold">{p[locale]}</h3>
                  <p className="m-0 mb-2 text-[12.5px] text-ink-soft">{p.kind ? l.kinds[p.kind] : m.anyKind}</p>
                  <dl className="m-0 space-y-2 text-[13px]" dir="ltr" lang="en">
                    <div>
                      <dt className="font-semibold">{m.proposalColumns.fits}</dt>
                      <dd className="m-0">{p.fits}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">{m.proposalColumns.phases}</dt>
                      <dd className="m-0">{p.phases.join(" · ")}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">{m.proposalColumns.factors}</dt>
                      <dd className="m-0">{p.factors.join(" · ")}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">{m.proposalColumns.excluded}</dt>
                      <dd className="m-0">{p.usuallyExcluded.join(" · ")}</dd>
                    </div>
                  </dl>
                </section>
              );
            })}
          </div>
        </Panel>

        <Panel title={m.discovery} id="discovery">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-discovery-banks>
            {DISCOVERY_BANK_IDS.map((id) => {
              const b = DISCOVERY_BANKS[id];
              return (
                <section key={id} aria-label={b[locale]} className="rounded-xl border border-line p-4" data-bank={id}>
                  <h3 className="m-0 mb-1 text-[14.5px] font-semibold">{b[locale]}</h3>
                  <p className="m-0 mb-2 text-[13px] text-ink-soft" dir="ltr" lang="en">
                    {b.why}
                  </p>
                  <p className="m-0 text-[12px] font-semibold text-ink-soft">{m.examplesLabel}</p>
                  <ul className="m-0 list-disc ps-5 text-[13px]">
                    {b.examples.map((q) => (
                      <li key={q.en}>{q[locale]}</li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </Panel>

        <Panel title={m.quality} id="quality">
          <ul className="m-0 list-none space-y-3 p-0" data-quality-rules>
            {QUALITY_RULES.map((r) => (
              <li key={r.id} className="rounded-xl border border-line p-3" data-rule={r.id}>
                <p className="m-0 text-[14px] font-semibold" dir="ltr" lang="en">
                  {r.rule}
                </p>
                <p className="m-0 mt-0.5 text-[13px] text-ink-soft" dir="ltr" lang="en">
                  {r.why}
                  {r.enforcement ? ` ${r.enforcement}` : ""}
                </p>
                <p className="m-0 mt-1 text-[12px] font-semibold text-mint-deep">{m.checks[r.check]}</p>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={m.rubric} id="rubric">
          <ol className="m-0 space-y-2 ps-5 text-[14px]" data-rubric>
            {RUBRIC.map((r) => (
              <li key={r.id}>
                <strong>{r[locale]}</strong>: {r.question[locale]}
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title={m.checklist} id="checklist">
          <ul className="m-0 list-disc space-y-1.5 ps-5 text-[14px]" data-approval-checklist>
            {APPROVAL_CHECKLIST.map((c) => (
              <li key={c.id}>{c[locale]}</li>
            ))}
          </ul>
        </Panel>

        <Panel title={l.manual} id="manual">
          <ul className="m-0 list-disc space-y-1.5 ps-5 text-[14px]" data-manual-cases>
            {l.manualItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
