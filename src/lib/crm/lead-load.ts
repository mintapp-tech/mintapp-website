import "server-only";
import { cache } from "react";
import { getInquiry } from "@/lib/dashboard/data";
import { inquiryExtra, leadDetail } from "./data";
import { selectGenerator } from "@/lib/preparation/config";

// One read of each part of a lead per request, shared by the lead's layout and
// whichever tab is open. Callers must have passed requireAdmin() first.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isLeadId = (id: string) => UUID.test(id);

export const loadInquiry = cache((id: string) => getInquiry(id));
export const loadExtra = cache((id: string) => inquiryExtra(id));
export const loadLead = cache((id: string) => leadDetail(id));

// Whether automated preparation can run here, and with what (never a key).
export function automationStatus(paused: readonly { provider: string }[]) {
  const g = selectGenerator();
  return g.enabled
    ? { enabled: true as const, provider: g.generator.id, model: g.generator.model, paused: paused.some((p) => p.provider === g.generator.id) }
    : { enabled: false as const, provider: null, model: null, paused: paused.length > 0 };
}
