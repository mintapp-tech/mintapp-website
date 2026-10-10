import type { Metadata } from "next";
import Link from "next/link";
import { card } from "@/components/dashboard/ui";
import { PageHead, Panel } from "@/components/crm/parts";
import DesignPreview from "@/components/pack/DesignPreview";
import { requireAdmin } from "@/lib/admin/auth/state";
import { adminText } from "@/lib/admin/locale";
import { DESIGN_EXAMPLES } from "@/lib/pack/examples";
import { PATTERNS, PATTERN_IDS, TEMPLATES, TEMPLATE_IDS } from "@/lib/pack/patterns";

export const dynamic = "force-dynamic";
// Internal only: never indexed.
export const metadata: Metadata = { title: "Design library", robots: { index: false, follow: false } };

const th = "px-3 py-2.5 text-start text-[12px] font-bold text-ink-soft";
const td = "px-3 py-2.5 align-top text-[13.5px]";

// The pattern library as the founders review it: every pattern and template,
// when a design falls back to a person, and synthetic examples drawn by the
// same trusted templates as a real initial design.
export default async function DesignLibraryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { locale, t } = await adminText();
  const l = t.lead.library;
  const d = t.lead.detail.design;
  const chosen = String((await searchParams).example ?? "");
  const example = DESIGN_EXAMPLES.find((e) => e.id === chosen) ?? DESIGN_EXAMPLES[0];

  return (
    <>
      <PageHead title={l.title} />
      <p className="mt-[-12px] mb-6 max-w-[72ch] text-[14px] text-ink-soft">{l.intro}</p>

      <div className="flex flex-col gap-6">
        <section aria-labelledby="examples" className={`${card} p-5 sm:p-6`} data-design-examples>
          <h2 id="examples" className="m-0 mb-3 text-[17px] font-bold">
            {l.examples}
          </h2>
          <nav aria-label={l.examples} className="mb-5">
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {DESIGN_EXAMPLES.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/settings/design-library?example=${e.id}`}
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
          <DesignPreview design={example.design} labels={{ ...d.labels, screen: d.screen }} locale={locale} />
        </section>

        <Panel title={l.patterns} id="patterns">
          <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0" role="region" aria-label={l.patterns} tabIndex={0}>
            <table className="w-full min-w-[720px] border-collapse" data-pattern-table>
              <thead className="border-b border-line">
                <tr>
                  {(["id", "kind", "name", "use", "templates"] as const).map((k) => (
                    <th key={k} scope="col" className={th}>
                      {l.columns[k]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PATTERN_IDS.map((id) => {
                  const p = PATTERNS[id];
                  return (
                    <tr key={id} className="border-t border-line" data-pattern={id}>
                      <td className={td} dir="ltr">
                        <code>{id}</code>
                      </td>
                      <td className={td}>{l.kinds[p.kind]}</td>
                      <td className={td}>
                        {p.en}
                        <span className="block text-ink-soft" dir="rtl" lang="ar">
                          {p.ar}
                        </span>
                      </td>
                      <td className={td} dir="ltr" lang="en">
                        {p.fits}
                      </td>
                      <td className={td} dir="ltr">
                        {p.templates.join(", ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title={l.templates} id="templates">
          <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0" role="region" aria-label={l.templates} tabIndex={0}>
            <table className="w-full min-w-[520px] border-collapse" data-template-table>
              <thead className="border-b border-line">
                <tr>
                  {(["id", "kinds", "items", "frames"] as const).map((k) => (
                    <th key={k} scope="col" className={th}>
                      {l.templateColumns[k]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TEMPLATE_IDS.map((id) => {
                  const tpl = TEMPLATES[id];
                  const kinds = tpl.kinds as readonly string[];
                  return (
                    <tr key={id} className="border-t border-line" data-template={id}>
                      <td className={td} dir="ltr">
                        <code>{id}</code>
                      </td>
                      <td className={td}>{kinds.map((k) => l.kinds[k]).join(", ")}</td>
                      <td className={td}>{tpl.maxItems}</td>
                      <td className={td}>{kinds.includes("mobile_app") ? l.frames.mobile : l.frames.other}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
