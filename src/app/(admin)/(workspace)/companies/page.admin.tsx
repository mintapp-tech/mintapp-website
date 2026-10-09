import type { Metadata } from "next";
import Link from "next/link";
import Notice from "@/components/crm/Notice";
import { SelectField, TextField } from "@/components/crm/Fields";
import { Empty, PageHead, Panel, linkClass, smallMuted } from "@/components/crm/parts";
import SubmitButton from "@/components/dashboard/SubmitButton";
import { Chip, button, card, primary } from "@/components/dashboard/ui";
import { requireAdmin } from "@/lib/admin/auth/state";
import { adminText } from "@/lib/admin/locale";
import { companyList, duplicatesReport } from "@/lib/crm/data";
import { createCompanyAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Companies" };

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { t } = await adminText();
  const c = t.crm.companies;
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 120) : "";
  const [rows, duplicates] = await Promise.all([companyList(q), duplicatesReport()]);
  const groups = duplicates.companies.length + duplicates.contacts.length + duplicates.inquiries.length;

  return (
    <>
      <PageHead eyebrowText={t.crm.nav.companies} title={c.title}>
        <div className="flex flex-wrap gap-2">
          <form action="/export/companies" method="post">
            <button type="submit" className={button}>
              {t.crm.common.export}
            </button>
          </form>
        </div>
      </PageHead>
      <p className="mt-0 mb-5 max-w-[72ch] text-[13.5px] text-ink-soft">{c.intro}</p>
      <Notice n={sp.n} e={sp.e} t={t.crm} />

      <form method="get" action="/companies" role="search" className={`${card} mb-6 flex flex-wrap items-end gap-3 p-4`}>
        <div className="min-w-[14rem] flex-1">
          <TextField id="company-q" name="q" text={c.search} placeholder={c.searchPlaceholder} defaultValue={q} maxLength={120} />
        </div>
        <SubmitButton className={primary}>{t.crm.common.apply}</SubmitButton>
        {q && (
          <Link href="/companies" className={button}>
            {t.crm.common.clear}
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <Empty>{q ? t.crm.filters.noMatches : c.empty}</Empty>
      ) : (
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full border-collapse text-start text-[14px]">
            <caption className="sr-only">{c.title}</caption>
            <thead className="border-b border-line bg-surface-2/60">
              <tr className="text-start text-[11.5px] font-bold tracking-[0.08em] text-ink-faint uppercase rtl:text-[12.5px] rtl:tracking-normal">
                <th scope="col" className="px-5 py-3 text-start">
                  {c.columns.name}
                </th>
                <th scope="col" className="px-4 py-3 text-start">
                  {c.columns.country}
                </th>
                <th scope="col" className="px-4 py-3 text-start">
                  {c.columns.contacts}
                </th>
                <th scope="col" className="px-4 py-3 text-start">
                  {c.columns.inquiries}
                </th>
                <th scope="col" className="px-5 py-3">
                  <span className="sr-only">{c.duplicate}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line first:border-t-0 hover:bg-canvas/70" data-company={r.id}>
                  <td className="px-5 py-3.5">
                    <Link href={`/companies/${r.id}`} className={linkClass}>
                      <bdi>{r.name}</bdi>
                    </Link>
                    {r.website_host && (
                      <span className="block text-[12.5px] text-ink-faint" dir="ltr">
                        {r.website_host}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">{r.country ?? <span className="text-ink-faint">–</span>}</td>
                  <td className="px-4 py-3.5">{r.contacts}</td>
                  <td className="px-4 py-3.5">
                    {r.inquiries}
                    {r.open_inquiries > 0 && <span className={`ms-2 ${smallMuted}`}>{c.openInquiries(r.open_inquiries)}</span>}
                  </td>
                  <td className="px-5 py-3.5">{r.possible_duplicate && <Chip tone="warn">{c.duplicate}</Chip>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <Panel title={c.add} id="add-company">
          <form action={createCompanyAction} className="flex flex-col gap-3">
            <TextField id="new-company-name" name="name" text={c.name} required maxLength={160} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField id="new-company-website" name="website" text={c.website} maxLength={300} ltr />
              <TextField id="new-company-country" name="country" text={c.country} maxLength={80} />
              <TextField id="new-company-sector" name="sector" text={c.sector} maxLength={120} />
              <SelectField id="new-company-language" name="language" text={c.language} blank={t.crm.common.notSet} options={[{ value: "en", label: t.languages.en }, { value: "ar", label: t.languages.ar }]} />
            </div>
            <SubmitButton className={`${primary} self-start`}>{t.crm.common.add}</SubmitButton>
          </form>
        </Panel>

        <Panel title={c.duplicatesTitle} id="duplicates" aside={groups ? <span className={smallMuted}>{groups}</span> : null}>
          <p className="mt-0 mb-3 text-[13px] text-ink-soft">{c.duplicatesHelp}</p>
          {groups === 0 ? (
            <p className="m-0 text-[13px] text-ink-faint">{c.noDuplicates}</p>
          ) : (
            <ul className="m-0 list-none p-0 text-[13.5px]" data-duplicate-groups>
              {duplicates.companies.map((g) => (
                <li key={g[0].id} className="border-t border-line py-2 first:border-t-0 first:pt-0">
                  {g.map((m, i) => (
                    <span key={m.id}>
                      {i > 0 && " · "}
                      <Link href={`/companies/${m.id}`} className={linkClass}>
                        <bdi>{m.name}</bdi>
                      </Link>
                    </span>
                  ))}
                </li>
              ))}
              {duplicates.contacts.map((g) => (
                <li key={g[0].id} className="border-t border-line py-2">
                  {g.map((m, i) => (
                    <span key={m.id}>
                      {i > 0 && " · "}
                      <Link href={`/contacts/${m.id}`} className={linkClass}>
                        <bdi>{m.name}</bdi>
                      </Link>
                    </span>
                  ))}
                </li>
              ))}
              {duplicates.inquiries.map((g) => (
                <li key={g[0].id} className="border-t border-line py-2">
                  {g.map((m, i) => (
                    <span key={m.id}>
                      {i > 0 && " · "}
                      <Link href={`/inquiries/${m.id}`} className={linkClass}>
                        <bdi>{m.name}</bdi>
                      </Link>
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
