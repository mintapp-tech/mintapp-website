"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth/state";
import * as crm from "@/lib/crm/data";
import { companySchema, contactSchema } from "@/lib/crm/schemas";
import { mutate, optionalUuid, parseForm, uuid } from "../mutate";

// Companies and contacts. A company may have several contacts; a contact needs
// no company. Nothing is merged or deleted: possible duplicates are only shown.

export async function createCompanyAction(form: FormData) {
  const member = await requireAdmin();
  let created: string | null = null;
  let failure: string | null = null;
  try {
    created = await crm.saveCompany(null, parseForm(companySchema, form), member.email);
  } catch {
    failure = "invalid";
  }
  if (created) redirect(`/companies/${created}?n=created`);
  redirect(`/companies?e=${failure ?? "failed"}`);
}

export async function saveCompanyAction(form: FormData) {
  const member = await requireAdmin();
  const companyId = uuid(form, "companyId");
  await mutate(`/companies/${companyId}`, "saved", async () => {
    await crm.saveCompany(companyId, parseForm(companySchema, form), member.email);
  }, "details");
}

// Creates a contact at a company (companyId set) or on its own.
export async function createContactAction(form: FormData) {
  const member = await requireAdmin();
  const companyId = optionalUuid(form, "companyId");
  const back = companyId ? `/companies/${companyId}` : "/companies";
  let created: string | null = null;
  let failure: string | null = null;
  try {
    created = await crm.saveContact(null, companyId, parseForm(contactSchema, form), member.email);
  } catch {
    failure = "invalid";
  }
  if (created) redirect(`/contacts/${created}?n=created`);
  redirect(`${back}?e=${failure ?? "failed"}#contacts`);
}

export async function saveContactAction(form: FormData) {
  const member = await requireAdmin();
  const contactId = uuid(form, "contactId");
  await mutate(`/contacts/${contactId}`, "saved", async () => {
    const companyId = optionalUuid(form, "companyId");
    // The company is part of the form; sending it moves the contact (or detaches it).
    await crm.saveContact(contactId, companyId, { ...parseForm(contactSchema, form), company_id: companyId }, member.email);
  });
}
