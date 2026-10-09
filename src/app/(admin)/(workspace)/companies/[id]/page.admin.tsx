import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactFields } from "@/components/crm/ContactFields";
import { SelectField, TextField } from "@/components/crm/Fields";
import Notice from "@/components/crm/Notice";
import { Empty, Panel, StageChip, linkClass, smallMuted } from "@/components/crm/parts";
import SubmitButton from "@/components/dashboard/SubmitButton";
import { Chip, formatDate, primary } from "@/components/dashboard/ui";
import { requireAdmin } from "@/lib/admin/auth/state";
import { adminText } from "@/lib/admin/locale";
import { companyGet } from "@/lib/crm/data";
import { safeHref } from "@/lib/crm/schemas";
import { createContactAction, saveCompanyAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Company" };

export default async function CompanyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await companyGet(id);
  if (!detail) notFound();
  const { locale, t } = await adminText();
  const c = t.crm.companies;
  const sp = await searchParams;
  const { company, contacts, inquiries, projects, duplicates } = detail;
  const href = safeHref(company.website);

  return (
    <>
      <Link href="/companies" className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-soft hover:text-ink">
        <span aria-hidden className="rtl:-scale-x-100">←</span> {c.title}
      </Link>
      <header className="mt-4 mb-6">
        <h1 className="m-0 text-[28px] leading-tight font-bold tracking-[-0.02em] sm:text-[32px] rtl:tracking-normal">
          <bdi>{company.name}</bdi>
        </h1>
        <p className="mt-1.5 mb-0 text-[13.5px] text-ink-soft">
          {[company.country, company.sector].filter(Boolean).join(" · ")}
          {href && (
            <>
              {company.country || company.sector ? " · " : ""}
              <a href={href} rel="noreferrer noopener" target="_blank" className={linkClass} dir="ltr">
                {company.website_host}
              </a>
            </>
          )}
        </p>
      </header>
      <Notice n={sp.n} e={sp.e} t={t.crm} />

      {duplicates.length > 0 && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-[13.5px] text-amber-950" data-duplicates>
          <p className="m-0 font-semibold">{c.sameCompany}</p>
          <p className="m-0 mt-1 text-[12.5px]">{c.duplicatesHelp}</p>
          <ul className="mt-2 mb-0 list-none p-0">
            {duplicates.map((d) => (
              <li key={d.id}>
                <Link href={`/companies/${d.id}`} className={linkClass}>
                  <bdi>{d.name}</bdi>
                </Link>
                {d.website_host ? ` · ${d.website_host}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Panel title={c.contacts} id="contacts" aside={<span className={smallMuted}>{contacts.length}</span>}>
            {contacts.length === 0 ? (
              <Empty>{c.noContacts}</Empty>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-3 p-0" data-contacts>
                {contacts.map((k) => (
                  <li key={k.id} className="rounded-xl border border-line p-4" data-contact={k.id}>
                    <p className="m-0 flex flex-wrap items-center gap-2">
                      <Link href={`/contacts/${k.id}`} className={`${linkClass} text-[15px]`}>
                        <bdi>{k.name}</bdi>
                      </Link>
                      {k.role && <span className={smallMuted}>{k.role}</span>}
                      {k.do_not_contact && <Chip tone="attention">{t.crm.contacts.doNotContact}</Chip>}
                    </p>
                    <dl className="m-0 mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-[13.5px]">
                      {k.email && (
                        <>
                          <dt className="text-ink-soft">{t.crm.contacts.email}</dt>
                          <dd className="m-0 break-words" dir="ltr">
                            {k.email}
                          </dd>
                        </>
                      )}
                      {k.phone && (
                        <>
                          <dt className="text-ink-soft">{t.crm.contacts.phone}</dt>
                          <dd className="m-0" dir="ltr">
                            {k.phone}
                          </dd>
                        </>
                      )}
                      <dt className="text-ink-soft">{t.crm.contacts.consentStatus}</dt>
                      <dd className="m-0">
                        {t.crm.consent[k.consent_status]}
                        {k.consent_at ? ` · ${formatDate(k.consent_at, false, locale)}` : ""}
                      </dd>
                    </dl>
                  </li>
                ))}
              </ul>
            )}
            <details className="group mt-5 border-t border-line pt-4">
              <summary className="cursor-pointer text-[14px] font-semibold">{c.addContact}</summary>
              <form action={createContactAction} className="mt-3 flex flex-col gap-3">
                <input type="hidden" name="companyId" value={company.id} />
                <p className="m-0 text-[12.5px] text-ink-faint">{t.crm.contacts.privacy}</p>
                <ContactFields prefix="new-contact" t={t} contact={null} />
                <SubmitButton className={`${primary} self-start`}>{t.crm.common.add}</SubmitButton>
              </form>
            </details>
          </Panel>

          <Panel title={c.inquiries} id="inquiries" aside={<span className={smallMuted}>{inquiries.length}</span>}>
            {inquiries.length === 0 ? (
              <Empty>{c.noInquiries}</Empty>
            ) : (
              <ul className="m-0 list-none p-0 text-[14px]">
                {inquiries.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2.5 first:border-t-0 first:pt-0">
                    <Link href={`/inquiries/${i.id}`} className={linkClass}>
                      <bdi>{i.client_name}</bdi>
                    </Link>
                    <span className="flex items-center gap-2">
                      <span className={smallMuted}>{formatDate(i.created_at, false, locale)}</span>
                      <StageChip stage={i.stage} t={t.crm} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel title={c.detailsTitle} id="details">
            <form action={saveCompanyAction} className="flex flex-col gap-3">
              <input type="hidden" name="companyId" value={company.id} />
              <TextField id="company-name" name="name" text={c.name} defaultValue={company.name} required maxLength={160} />
              <TextField id="company-website" name="website" text={c.website} defaultValue={company.website} maxLength={300} ltr />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField id="company-country" name="country" text={c.country} defaultValue={company.country} maxLength={80} />
                <TextField id="company-sector" name="sector" text={c.sector} defaultValue={company.sector} maxLength={120} />
              </div>
              <SelectField id="company-language" name="language" text={c.language} defaultValue={company.language} blank={t.crm.common.notSet} options={[{ value: "en", label: t.languages.en }, { value: "ar", label: t.languages.ar }]} />
              <SubmitButton className={`${primary} self-start`}>{c.saveDetails}</SubmitButton>
            </form>
          </Panel>

          <Panel title={c.projects} id="projects" aside={<span className={smallMuted}>{projects.length}</span>}>
            {projects.length === 0 ? (
              <Empty>{c.noProjects}</Empty>
            ) : (
              <ul className="m-0 list-none p-0 text-[14px]">
                {projects.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 border-t border-line py-2.5 first:border-t-0 first:pt-0">
                    <Link href={`/projects/${p.id}`} className={linkClass}>
                      <bdi>{p.name}</bdi>
                    </Link>
                    <Chip>{t.crm.projectStatuses[p.status]}</Chip>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
