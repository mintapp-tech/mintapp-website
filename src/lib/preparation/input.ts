// What a generator may see about an inquiry. Only the project brief and the
// client's own structured answers: never the name, email, phone, company,
// website, referral or tracking fields. The same text is the source that
// every "client fact" in a draft must quote verbatim.

import { PROJECT_TYPE_WORDS, clientProjectType } from "@/lib/dashboard/project-type";
import { scrubContactDetails } from "./scrub";

export type BriefLanguage = "en" | "ar";

export interface InquiryForPreparation {
  preferred_language: string;
  project_type: string | null;
  project_description: string;
  budget_range: string | null;
  timeline: string | null;
  country: string | null;
  // The inquiry's own contact values (name, company, email, phone, website):
  // removed from the brief wherever the client repeated them. Never sent anywhere.
  redact?: readonly string[];
}

export interface GenerationInput {
  language: BriefLanguage;
  // The exact text sent to a generator and used to check evidence.
  brief: string;
}

const LABELS: Record<BriefLanguage, Record<"type" | "budget" | "timeline" | "country" | "description", string>> = {
  en: { type: "Project type", budget: "Budget range (client-stated)", timeline: "Timeline (client-stated)", country: "Country", description: "Project description" },
  ar: { type: "نوع المشروع", budget: "الميزانية (كما ذكرها العميل)", timeline: "الجدول الزمني (كما ذكره العميل)", country: "الدولة", description: "وصف المشروع" },
};

export function buildGenerationInput(inquiry: InquiryForPreparation): GenerationInput {
  const language: BriefLanguage = inquiry.preferred_language === "ar" ? "ar" : "en";
  const l = LABELS[language];
  // Only an explicit choice on the form; anything else is "not provided" and left out.
  const projectType = clientProjectType(inquiry.project_type);
  const lines = [
    projectType ? `${l.type}: ${PROJECT_TYPE_WORDS[language][projectType]}` : null,
    inquiry.budget_range ? `${l.budget}: ${inquiry.budget_range}` : null,
    inquiry.timeline ? `${l.timeline}: ${inquiry.timeline}` : null,
    inquiry.country ? `${l.country}: ${inquiry.country}` : null,
    `${l.description}:`,
    // Contact details the client typed into the description are removed: a generator
    // (or a copied prompt) gets the brief, not a way to reach the client.
    scrubContactDetails(inquiry.project_description.trim(), inquiry.redact),
  ].filter((line): line is string => line !== null);
  return { language, brief: lines.join("\n") };
}
