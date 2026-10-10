"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth/state";
import * as crm from "@/lib/crm/data";
import { formObject, nextActionSchema, prioritySchema, prospectSchema } from "@/lib/crm/schemas";
import { errorCodeOf, memberId, mutate, uuid } from "../mutate";

// Growth records what the team does. Nothing here sends a message to anyone.

// The quick form: six things (account, contact or profile link, reason now,
// owner, next action and date, priority), plus any research. Everything is
// checked before anything is written.
export async function quickProspectAction(form: FormData) {
  const member = await requireAdmin();
  let created: string | null = null;
  let failure = "failed";
  try {
    const values = formObject(form);
    const v = prospectSchema.parse(values);
    memberId(v.owner);
    const next = nextActionSchema.parse({ action: values.action, owner: v.owner, dueOn: values.dueOn });
    const { priority } = prioritySchema.parse({ priority: values.priority ?? "" });
    created = await crm.saveProspect(null, v, member.email);
    if (created) {
      await crm.setProspectFollowUp(created, next.action, next.owner, next.dueOn, member.email);
      if (priority) await crm.setProspectPriority(created, priority, member.email);
    }
  } catch (e) {
    failure = errorCodeOf(e);
    console.error(`crm_action_failed:quick_prospect:${failure}`);
  }
  if (created) redirect(`/growth?n=created#prospect-${created}`);
  redirect(`/growth?e=${failure}#add-prospect`);
}

export async function prospectPriorityAction(form: FormData) {
  const member = await requireAdmin();
  const id = uuid(form, "prospectId");
  await mutate(`/outreach/${id}`, "saved", async () => {
    const { priority } = prioritySchema.parse({ priority: form.get("priority") ?? "" });
    await crm.setProspectPriority(id, priority ?? "", member.email);
  }, "priority");
}
