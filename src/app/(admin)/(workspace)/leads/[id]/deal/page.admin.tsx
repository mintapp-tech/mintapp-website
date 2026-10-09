import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SubmitButton from "@/components/dashboard/SubmitButton";
import { Chip, primary } from "@/components/dashboard/ui";
import Notice from "@/components/crm/Notice";
import { Panel } from "@/components/crm/parts";
import { SelectField, TextAreaField, TextField } from "@/components/crm/Fields";
import { ConversionPanel, ProposalPanel } from "@/components/crm/InquiryCrm";
import { requireAdmin } from "@/lib/admin/auth/state";
import { teamMembers } from "@/lib/admin/auth/config";
import { adminText } from "@/lib/admin/locale";
import { isLeadId, loadExtra, loadLead } from "@/lib/crm/lead-load";
import { CONTRACT_STATUSES } from "@/lib/crm/schemas";
import { saveDealAction } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Deal" };

// The commercial side after the meeting: the final proposal (versioned, approved
// by the other founder), the contract as recorded by hand, and the project once won.
export default async function LeadDeal({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireAdmin();
  const { id } = await params;
  if (!isLeadId(id)) notFound();
  const [extra, lead] = await Promise.all([loadExtra(id), loadLead(id)]);
  if (!extra || !lead) notFound();
  const sp = await searchParams;
  const { locale, t } = await adminText();
  const d = t.lead.detail.deal;
  const members = teamMembers();
  const contract = lead.deal.contract_status;

  return (
    <>
      <Notice n={sp.n} e={sp.e} t={t.crm} />
      <p className="mt-0 mb-5 text-[14px] text-ink-soft">{d.intro}</p>
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <ProposalPanel inquiryId={id} extra={extra} t={t} locale={locale} members={members} me={me} />
        </div>
        <div className="flex flex-col gap-5">
          <Panel title={d.contract} id="contract" aside={contract ? <Chip tone={contract === "signed" ? "ok" : contract === "declined" ? "attention" : "info"} data-contract={contract}>{t.lead.contract[contract]}</Chip> : null}>
            <p className="mt-0 mb-3 text-[13px] text-ink-soft">{d.contractHelp}</p>
            <form action={saveDealAction} className="flex flex-col gap-3">
              <input type="hidden" name="inquiryId" value={id} />
              <SelectField id="contract-status" name="contract_status" text={d.contractStatus} blank="–" defaultValue={contract} options={CONTRACT_STATUSES.map((c) => ({ value: c, label: t.lead.contract[c] }))} />
              <TextField id="contract-signed" name="contract_signed_on" type="date" text={d.signedOn} defaultValue={lead.deal.contract_signed_on} />
              <TextField id="contract-reference" name="contract_reference" text={d.reference} hint={d.referenceHelp} maxLength={200} defaultValue={lead.deal.contract_reference} />
              <TextAreaField id="commercial-notes" name="commercial_notes" text={d.notes} rows={4} maxLength={4000} defaultValue={lead.deal.commercial_notes} />
              <SubmitButton className={`${primary} self-start`}>{d.save}</SubmitButton>
            </form>
          </Panel>
          <ConversionPanel inquiryId={id} extra={extra} t={t} />
        </div>
      </div>
    </>
  );
}
