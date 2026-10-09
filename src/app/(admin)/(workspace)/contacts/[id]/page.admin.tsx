import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactFields } from "@/components/crm/ContactFields";
import { SelectField } from "@/components/crm/Fields";
import Notice from "@/components/crm/Notice";
import { Empty, Panel, StageChip, linkClass, smallMuted } from "@/components/crm/parts";
import SubmitButton from "@/components/dashboard/SubmitButton";
import { Chip, formatDate, primary } from "@/components/dashboard/ui";
import { requireAdmin } from "@/lib/admin/auth/state";
import { adminText } from "@/lib/admin/locale";
import { companyList, contactGet } from "@/lib/crm/data";
import { saveContactAction } from "../../companies/actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contact" };

// A contact's own page is where their email address and phone number are shown.
export default async function ContactPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [detail, companies] = await Promise.all([contactGet(id), companyList()]);
  if (!detail) notFound();
  const { locale, t } = await adminText();
  const c = t.crm.contacts;
  const sp = await searchParams;
  const { contact, company, inquiries, duplicates } = detail;

  return (
    <>
      <Link href={company ? `/companies/${company.id}` : "/companies"} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-soft hover:text-ink">
        <span aria-hidden className="rtl:-scale-x-100">←</span> {company ? company.name : t.crm.companies.title}
      </Link>
      <header className="mt-4 mb-6">
        <p className="m-0 flex flex-wrap items-center gap-2 text-[13.5px] text-ink-soft">
          {contact.role}
          <Chip tone={contact.consent_status === "withdrawn" ? "attention" : "neutral"}>{t.crm.consent[contact.consent_status]}</Chip>
          {contact.do_not_contact && <Chip tone="attention">{c.doNotContact}</Chip>}
        </p>
        <h1 className="m-0 mt-1.5 text-[28px] leading-tight font-bold tracking-[-0.02em] sm:text-[32px] rtl:tracking-normal">
          <bdi>{contact.name}</bdi>
        </h1>
        <p className="mt-1.5 mb-0 text-[12.5px] text-ink-faint">{c.privacy}</p>
      </header>
      <Notice n={sp.n} e={sp.e} t={t.crm} />

      {duplicates.length > 0 && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-[13.5px] text-amber-950" data-duplicates>
          <p className="m-0 font-semibold">{c.sameContact}</p>
          <p className="m-0 mt-1 text-[12.5px]">{t.crm.companies.duplicatesHelp}</p>
          <ul className="mt-2 mb-0 list-none p-0">
            {duplicates.map((d) => (
              <li key={d.id}>
                <Link href={`/contacts/${d.id}`} className={linkClass}>
                  <bdi>{d.name}</bdi>
                </Link>
                {d.company ? ` · ${d.company}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel title={c.title} id="details">
          <form action={saveContactAction} className="flex flex-col gap-4">
            <input type="hidden" name="contactId" value={contact.id} />
            <SelectField id="contact-company" name="companyId" text={c.company} defaultValue={contact.company_id} blank={c.noCompany} options={companies.map((k) => ({ value: k.id, label: k.name }))} />
            <ContactFields prefix="contact" t={t} contact={contact} />
            {contact.consent_at && <p className="m-0 text-[12.5px] text-ink-faint">{c.consentAt(formatDate(contact.consent_at, false, locale))}</p>}
            <SubmitButton className={`${primary} self-start`}>{c.save}</SubmitButton>
          </form>
        </Panel>

        <Panel title={t.crm.companies.inquiries} id="inquiries" aside={<span className={smallMuted}>{inquiries.length}</span>}>
          {inquiries.length === 0 ? (
            <Empty>{t.crm.companies.noInquiries}</Empty>
          ) : (
            <ul className="m-0 list-none p-0 text-[14px]">
              {inquiries.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2.5 first:border-t-0 first:pt-0">
                  <Link href={`/leads/${i.id}`} className={linkClass}>
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
    </>
  );
}
