"use server";

import { requireAdmin } from "@/lib/admin/auth/state";
import * as crm from "@/lib/crm/data";
import { projectStatusSchema } from "@/lib/crm/schemas";
import { mutate, uuid } from "../mutate";

export async function projectStatusAction(form: FormData) {
  const member = await requireAdmin();
  const projectId = uuid(form, "projectId");
  await mutate(`/projects/${projectId}`, "saved", async () => {
    await crm.setProjectStatus(projectId, projectStatusSchema.parse(form.get("status")), member.email);
  });
}
