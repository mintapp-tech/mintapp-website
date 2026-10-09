// Mintapp's pattern library, first version: a small, code-owned set of product
// patterns and the screen templates each may use. A language model chooses from
// these ids and fills the templates' text slots; it never names a component, and
// it never writes markup, styles or code. Kept deliberately small.

export type ProjectKind = "website" | "web_app" | "mobile_app";

// Screen templates: each maps to one trusted React component in
// src/components/pack/templates.tsx.
export const TEMPLATES = {
  // Websites
  hero: { kinds: ["website"], maxItems: 3 },
  value_points: { kinds: ["website"], maxItems: 4 },
  services: { kinds: ["website"], maxItems: 6 },
  how_it_works: { kinds: ["website", "web_app"], maxItems: 5 },
  catalogue: { kinds: ["website", "web_app"], maxItems: 6 },
  course_list: { kinds: ["website"], maxItems: 6 },
  booking_form: { kinds: ["website", "web_app"], maxItems: 6 },
  proof: { kinds: ["website"], maxItems: 3 },
  faq: { kinds: ["website"], maxItems: 5 },
  contact_cta: { kinds: ["website"], maxItems: 2 },
  // Web applications
  overview_dashboard: { kinds: ["web_app"], maxItems: 6 },
  record_table: { kinds: ["web_app"], maxItems: 6 },
  record_detail: { kinds: ["web_app"], maxItems: 6 },
  workflow_board: { kinds: ["web_app"], maxItems: 5 },
  schedule_calendar: { kinds: ["web_app"], maxItems: 6 },
  data_form: { kinds: ["web_app"], maxItems: 6 },
  // Mobile applications
  onboarding: { kinds: ["mobile_app"], maxItems: 3 },
  home: { kinds: ["mobile_app"], maxItems: 4 },
  list_search: { kinds: ["mobile_app"], maxItems: 6 },
  detail: { kinds: ["mobile_app"], maxItems: 5 },
  booking_order: { kinds: ["mobile_app"], maxItems: 5 },
  tracking: { kinds: ["mobile_app"], maxItems: 5 },
  profile: { kinds: ["mobile_app"], maxItems: 5 },
} as const satisfies Record<string, { kinds: readonly ProjectKind[]; maxItems: number }>;

export type TemplateId = keyof typeof TEMPLATES;
export const TEMPLATE_IDS = Object.keys(TEMPLATES) as TemplateId[];

export interface Pattern {
  kind: ProjectKind;
  en: string;
  ar: string;
  // What this pattern is for, for the model's choice and for the team.
  fits: string;
  templates: readonly TemplateId[];
}

export const PATTERNS = {
  studio_site: { kind: "website", en: "Service or studio website", ar: "موقع شركة خدمات أو استوديو", fits: "a company presenting its services and taking inquiries", templates: ["hero", "value_points", "services", "how_it_works", "proof", "faq", "contact_cta"] },
  saas_marketing: { kind: "website", en: "SaaS marketing website", ar: "موقع تسويقي لمنتج برمجي", fits: "a software product explaining its value and converting sign-ups", templates: ["hero", "value_points", "how_it_works", "proof", "faq", "contact_cta"] },
  marketplace_site: { kind: "website", en: "Marketplace website", ar: "موقع سوق إلكتروني", fits: "listings from many providers that visitors browse and request", templates: ["hero", "catalogue", "how_it_works", "proof", "faq", "contact_cta"] },
  academy_site: { kind: "website", en: "Academy website", ar: "موقع أكاديمية أو منصة تعليمية", fits: "courses or programmes that learners browse and apply to", templates: ["hero", "course_list", "how_it_works", "proof", "faq", "contact_cta"] },
  booking_site: { kind: "website", en: "Booking or service business website", ar: "موقع حجز لنشاط خدمي", fits: "a local service business where visitors choose a service and book a time", templates: ["hero", "services", "booking_form", "how_it_works", "faq", "contact_cta"] },
  dashboard_app: { kind: "web_app", en: "Dashboard", ar: "لوحة متابعة", fits: "people who monitor activity and act on what needs attention", templates: ["overview_dashboard", "record_table", "record_detail", "data_form"] },
  operations_app: { kind: "web_app", en: "Operations workflow", ar: "نظام تشغيل وسير عمل", fits: "a team moving requests or jobs through stages", templates: ["workflow_board", "record_table", "record_detail", "data_form", "overview_dashboard"] },
  marketplace_admin: { kind: "web_app", en: "Marketplace administration", ar: "إدارة سوق إلكتروني", fits: "operators who manage providers, listings and orders", templates: ["overview_dashboard", "record_table", "record_detail", "catalogue", "data_form"] },
  crm_app: { kind: "web_app", en: "CRM or workflow system", ar: "نظام علاقات عملاء أو متابعة", fits: "a team tracking customers or cases and the next action on each", templates: ["record_table", "record_detail", "workflow_board", "data_form", "overview_dashboard"] },
  scheduling_app: { kind: "web_app", en: "Scheduling system", ar: "نظام مواعيد وجدولة", fits: "staff and customers booking and managing appointments", templates: ["schedule_calendar", "booking_form", "record_table", "record_detail", "how_it_works"] },
  mobile_app: { kind: "mobile_app", en: "Mobile application", ar: "تطبيق جوّال", fits: "a phone app: onboarding, a home, finding things, booking or ordering, tracking and a profile", templates: ["onboarding", "home", "list_search", "detail", "booking_order", "tracking", "profile"] },
} as const satisfies Record<string, Pattern>;

export type PatternId = keyof typeof PATTERNS;
export const PATTERN_IDS = Object.keys(PATTERNS) as PatternId[];

export const isPatternId = (value: unknown): value is PatternId => typeof value === "string" && Object.hasOwn(PATTERNS, value);
export const isTemplateId = (value: unknown): value is TemplateId => typeof value === "string" && Object.hasOwn(TEMPLATES, value);

// The client's own answer on the form, as a project kind. "Not sure" and older
// values leave the choice to the pattern (or to manual preparation).
export function kindFromProjectType(projectType: string | null | undefined): ProjectKind | null {
  return projectType === "website" || projectType === "web_app" || projectType === "mobile_app" ? projectType : null;
}

// The catalogue as the prompt describes it.
export function catalogueText(): string {
  return PATTERN_IDS.map((id) => {
    const p = PATTERNS[id];
    return `- ${id} (${p.kind}): ${p.fits}. Screen templates: ${p.templates.join(", ")}.`;
  }).join("\n");
}
