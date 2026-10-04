// What a generator may see about an inquiry. Only the project brief and the
// client's own structured answers: never the name, email, phone, company,
// website, referral or tracking fields. The same text is the source that
// every "client fact" in a draft must quote verbatim.

export type BriefLanguage = "en" | "ar";

export interface InquiryForPreparation {
  preferred_language: string;
  project_type: string | null;
  project_description: string;
  budget_range: string | null;
  timeline: string | null;
  country: string | null;
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
  const lines = [
    inquiry.project_type ? `${l.type}: ${inquiry.project_type}` : null,
    inquiry.budget_range ? `${l.budget}: ${inquiry.budget_range}` : null,
    inquiry.timeline ? `${l.timeline}: ${inquiry.timeline}` : null,
    inquiry.country ? `${l.country}: ${inquiry.country}` : null,
    `${l.description}:`,
    inquiry.project_description.trim(),
  ].filter((line): line is string => line !== null);
  return { language, brief: lines.join("\n") };
}
