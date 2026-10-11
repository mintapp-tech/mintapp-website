import type { InquiryDetail } from "@/lib/dashboard/data";
import type { PackContext } from "@/lib/pack/schema";
import { buildGenerationInput, type GenerationInput } from "@/lib/preparation/input";
import { knownDetails } from "@/lib/preparation/scrub";

// A lead's Pack brief: the sanitised brief every check, the copied Claude prompt,
// the editor and the Direction Pack use (the client's contact details removed),
// built in one place so they can never disagree.

export function packInput(inquiry: InquiryDetail["inquiry"], budgetCurrency: string | null | undefined): GenerationInput {
  return buildGenerationInput({
    preferred_language: inquiry.language,
    project_type: inquiry.project_type,
    project_description: inquiry.project_description,
    budget_range: inquiry.budget_range,
    budget_currency: budgetCurrency ?? null,
    timeline: inquiry.timeline,
    country: inquiry.country,
    redact: knownDetails({ client_name: inquiry.client_name, company_name: inquiry.company_name, email: inquiry.email, phone: inquiry.phone, company_url: inquiry.company_url }),
  });
}

export const packContext = (input: GenerationInput): PackContext => ({ brief: input.brief, language: input.language, projectType: input.projectType });
