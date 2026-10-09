import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Empty, PageHead, Panel, StageChip, linkClass, smallMuted } from "@/components/crm/parts";
import { Chip, formatDate } from "@/components/dashboard/ui";
import { requireAdmin } from "@/lib/admin/auth/state";
import { adminText } from "@/lib/admin/locale";
import { search } from "@/lib/crm/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Search", robots: { index: false, follow: false } };

function Group({ title, id, count, children }: { title: string; id: string; count: number; children: ReactNode }) {
  return (
    <Panel title={title} id={id} aside={<span className={smallMuted}>{count}</span>}>
      {children}
    </Panel>
  );
}

// Finds companies, contacts, inquiries and prospects by name, company, words in
// the brief, email address or phone number. It never shows an email address or
// a phone number: those are on the detail pages.
export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { locale, t } = await adminText();
  const s = t.crm.search;
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 120) : "";
  const results = q.length >= 2 ? await search(q) : null;
  const total = results ? results.inquiries.length + results.companies.length + results.contacts.length + results.prospects.length : 0;

  return (
    <>
      <PageHead eyebrowText={t.crm.nav.searchPlaceholder} title={s.title}>
        <p className="m-0 max-w-[48ch] text-[12.5px] text-ink-faint">{s.privacy}</p>
      </PageHead>
      {q === "" ? null : !results ? (
        <Empty>{s.tooShort}</Empty>
      ) : (
        <>
          <p role="status" className="mt-0 mb-5 text-[14px] font-semibold">
            {s.results(q)}
          </p>
          {total === 0 ? (
            <Empty>{s.none}</Empty>
          ) : (
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
              {results.inquiries.length > 0 && (
                <Group title={s.inquiries} id="r-inquiries" count={results.inquiries.length}>
                  <ul className="m-0 list-none p-0 text-[14px]" data-results="inquiries">
                    {results.inquiries.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2.5 first:border-t-0 first:pt-0">
                        <span>
                          <Link href={`/leads/${r.id}`} className={linkClass}>
                            <bdi>{r.name}</bdi>
                          </Link>
                          {r.company && (
                            <span className="text-ink-soft">
                              {" · "}
                              <bdi>{r.company}</bdi>
                            </span>
                          )}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className={smallMuted}>{formatDate(r.at, false, locale)}</span>
                          <StageChip stage={r.stage} t={t.crm} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </Group>
              )}
              {results.companies.length > 0 && (
                <Group title={s.companies} id="r-companies" count={results.companies.length}>
                  <ul className="m-0 list-none p-0 text-[14px]" data-results="companies">
                    {results.companies.map((r) => (
                      <li key={r.id} className="border-t border-line py-2.5 first:border-t-0 first:pt-0">
                        <Link href={`/companies/${r.id}`} className={linkClass}>
                          <bdi>{r.name}</bdi>
                        </Link>
                        {r.country && <span className={`ms-2 ${smallMuted}`}>{r.country}</span>}
                      </li>
                    ))}
                  </ul>
                </Group>
              )}
              {results.contacts.length > 0 && (
                <Group title={s.contacts} id="r-contacts" count={results.contacts.length}>
                  <ul className="m-0 list-none p-0 text-[14px]" data-results="contacts">
                    {results.contacts.map((r) => (
                      <li key={r.id} className="border-t border-line py-2.5 first:border-t-0 first:pt-0">
                        <Link href={`/contacts/${r.id}`} className={linkClass}>
                          <bdi>{r.name}</bdi>
                        </Link>
                        <span className={`ms-2 ${smallMuted}`}>{[r.role, r.company].filter(Boolean).join(" · ")}</span>
                      </li>
                    ))}
                  </ul>
                </Group>
              )}
              {results.prospects.length > 0 && (
                <Group title={s.prospects} id="r-prospects" count={results.prospects.length}>
                  <ul className="m-0 list-none p-0 text-[14px]" data-results="prospects">
                    {results.prospects.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2.5 first:border-t-0 first:pt-0">
                        <span>
                          <Link href={`/outreach/${r.id}`} className={linkClass}>
                            <bdi>{r.company}</bdi>
                          </Link>
                          {r.contact && (
                            <span className="text-ink-soft">
                              {" · "}
                              <bdi>{r.contact}</bdi>
                            </span>
                          )}
                        </span>
                        <Chip>{t.crm.prospectStages[r.stage]}</Chip>
                      </li>
                    ))}
                  </ul>
                </Group>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
