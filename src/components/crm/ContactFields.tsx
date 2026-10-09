import type { AdminMessages } from "@/lib/admin/messages";
import { CONSENT_STATUSES, type ContactCard } from "@/lib/crm/types";
import { CheckboxField, SelectField, TextField, optionsOf } from "./Fields";

// The fields of a contact. Personal details: shown on a contact's own page and a
// company's page only, for the team only.
export function ContactFields({ prefix, t, contact }: { prefix: string; t: AdminMessages; contact: ContactCard | null }) {
  const c = t.crm.contacts;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField id={`${prefix}-name`} name="full_name" text={c.fullName} defaultValue={contact?.name} required maxLength={160} />
        <TextField id={`${prefix}-role`} name="role_title" text={c.role} defaultValue={contact?.role} maxLength={120} />
        <TextField id={`${prefix}-email`} name="email" type="email" text={c.email} defaultValue={contact?.email} maxLength={320} ltr />
        <TextField id={`${prefix}-phone`} name="phone" type="tel" text={c.phone} defaultValue={contact?.phone} maxLength={60} ltr />
        <SelectField id={`${prefix}-language`} name="preferred_language" text={c.language} defaultValue={contact?.language} blank={t.crm.common.notSet} options={[{ value: "en", label: t.languages.en }, { value: "ar", label: t.languages.ar }]} />
        <SelectField id={`${prefix}-consent`} name="consent_status" text={c.consentStatus} defaultValue={contact?.consent_status ?? "not_recorded"} required options={optionsOf(t.crm.consent, CONSENT_STATUSES)} />
      </div>
      <CheckboxField id={`${prefix}-dnc`} name="do_not_contact" text={c.doNotContact} hint={c.doNotContactHelp} defaultChecked={contact?.do_not_contact} />
    </div>
  );
}
