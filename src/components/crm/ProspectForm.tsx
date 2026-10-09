import type { TeamMember } from "@/lib/admin/auth/config";
import type { AdminMessages } from "@/lib/admin/messages";
import { CONTACT_CHANNELS, FIT_TIERS, PROSPECT_POOLS, type ProspectDetail } from "@/lib/crm/types";
import { CheckboxField, ScoreFields, SelectField, TextAreaField, TextField, optionsOf } from "./Fields";

// The research a prospect needs before any contact (campaign playbook, section 11):
// company and country, decision-maker and role, specific trigger, product or
// workflow observed, relevant case, why Mintapp may fit, owner, first-contact
// channel. The lead score and the do-not-contact switch live here too.
export function ProspectForm({ prefix, t, members, prospect }: { prefix: string; t: AdminMessages; members: TeamMember[]; prospect: ProspectDetail["prospect"] | null }) {
  const f = t.crm.outreach.fields;
  const p = prospect;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField id={`${prefix}-company`} name="company_name" text={f.company} defaultValue={p?.company_name} required maxLength={160} />
        <TextField id={`${prefix}-website`} name="website" text={f.website} defaultValue={p?.website} maxLength={300} ltr />
        <TextField id={`${prefix}-country`} name="country" text={f.country} defaultValue={p?.country} maxLength={80} />
        <TextField id={`${prefix}-sector`} name="sector" text={f.sector} defaultValue={p?.sector} maxLength={120} />
        <SelectField id={`${prefix}-pool`} name="pool" text={f.pool} defaultValue={p?.pool} blank={t.crm.outreach.choose} options={optionsOf(t.crm.pools, PROSPECT_POOLS)} />
        <SelectField
          id={`${prefix}-origin`}
          name="lead_origin"
          text={f.origin}
          defaultValue={p?.lead_origin ?? "outbound"}
          required
          options={(["warm", "outbound", "referral", "partner"] as const).map((v) => ({ value: v, label: t.crm.origins[v] }))}
        />
        <SelectField id={`${prefix}-owner`} name="owner" text={f.owner} defaultValue={p?.owner} required blank={t.crm.outreach.choose} options={members.map((m) => ({ value: m.id, label: m.name }))} />
        <SelectField id={`${prefix}-tier`} name="fit_tier" text={f.tier} defaultValue={p?.fit_tier} blank={t.crm.source.unknown} options={optionsOf(t.crm.fitTiers, FIT_TIERS)} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField id={`${prefix}-contact`} name="contact_name" text={f.contactName} defaultValue={p?.contact_name} maxLength={120} />
        <TextField id={`${prefix}-role`} name="contact_role" text={f.contactRole} defaultValue={p?.contact_role} maxLength={120} />
        <SelectField id={`${prefix}-channel`} name="contact_channel" text={f.channel} defaultValue={p?.contact_channel} blank={t.crm.outreach.choose} options={optionsOf(t.crm.channels, CONTACT_CHANNELS)} />
        <TextField id={`${prefix}-handle`} name="contact_handle" text={f.handle} hint={t.crm.outreach.handlePrivacy} defaultValue={p?.contact_handle} maxLength={200} ltr />
        <SelectField id={`${prefix}-language`} name="language" text={f.language} defaultValue={p?.language} blank={t.crm.common.notSet} options={[{ value: "en", label: t.languages.en }, { value: "ar", label: t.languages.ar }]} />
      </div>
      <TextField id={`${prefix}-trigger`} name="trigger_note" text={f.trigger} defaultValue={p?.trigger_note} maxLength={500} />
      <TextAreaField id={`${prefix}-observation`} name="observation" text={f.observation} defaultValue={p?.observation} rows={2} maxLength={1000} />
      <TextField id={`${prefix}-proof`} name="proof_case" text={f.proof} defaultValue={p?.proof_case} maxLength={300} />
      <TextAreaField id={`${prefix}-fit`} name="fit_reason" text={f.fit} defaultValue={p?.fit_reason} rows={2} maxLength={1000} />
      <ScoreFields idPrefix={`${prefix}-score`} score={p?.score ?? null} t={t.crm.score} />
      {p && <CheckboxField id={`${prefix}-dnc`} name="do_not_contact" text={t.crm.outreach.doNotContact} defaultChecked={p.do_not_contact} />}
    </div>
  );
}
