// Mintapp's product patterns and the screen templates each may use: the one
// code-owned catalogue that automated and manual preparation both choose from. A
// language model (or a founder) picks a pattern id and fills a template's short text
// slots; it never names a component, and never writes markup, styles or code.
// Every template maps to one trusted React component (src/components/pack/templates.tsx).

export type ProjectKind = "website" | "web_app" | "mobile_app";

// Screen templates, with the project kinds they suit and how many items they hold.
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
  trend_report: { kinds: ["web_app"], maxItems: 4 },
  record_table: { kinds: ["web_app"], maxItems: 6 },
  record_detail: { kinds: ["web_app"], maxItems: 6 },
  workflow_board: { kinds: ["web_app"], maxItems: 5 },
  schedule_calendar: { kinds: ["web_app"], maxItems: 6 },
  data_form: { kinds: ["web_app"], maxItems: 6 },
  // Shared states
  empty_state: { kinds: ["web_app", "mobile_app"], maxItems: 3 },
  confirmation: { kinds: ["website", "web_app", "mobile_app"], maxItems: 4 },
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

// What each template draws, for the library page and the rules for manual preparation.
export const TEMPLATE_NOTES: Record<TemplateId, string> = {
  hero: "Headline, supporting text, actions and an image placeholder; optional short cards.",
  value_points: "A heading and three or four value cards.",
  services: "A heading and service cards.",
  how_it_works: "A heading and numbered steps.",
  catalogue: "A heading and listing cards with image placeholders.",
  course_list: "The catalogue layout for courses or programmes.",
  booking_form: "A heading and a form of labelled fields with actions.",
  proof: "Proof points the client can stand behind (never invented figures, users or quotes).",
  faq: "A heading and question rows.",
  contact_cta: "A closing call to action.",
  overview_dashboard: "App frame, heading and status tiles; values are drawn as placeholders, never invented.",
  trend_report: "App frame, the measures to watch as a legend, and a chart whose bars are placeholders: no values are ever drawn.",
  record_table: "App frame, filter chips and record rows.",
  record_detail: "App frame, fields and an image placeholder.",
  workflow_board: "App frame and stage columns.",
  schedule_calendar: "App frame, a calendar grid and the day's rows.",
  data_form: "App frame and a form.",
  empty_state: "The first-run or nothing-yet state: what this place is for and the first actions.",
  confirmation: "A dialog over the dimmed screen: what is about to happen, a summary and the two choices.",
  onboarding: "Image placeholder, headline, points and an action.",
  home: "Headline, image placeholder, cards and an action.",
  list_search: "Headline, search field, filter chips and rows.",
  detail: "Image placeholder, headline, rows and an action.",
  booking_order: "The booking or order form in a phone.",
  tracking: "A vertical progress timeline.",
  profile: "Avatar placeholder, headline and rows.",
};

export interface Pattern {
  kind: ProjectKind;
  en: string;
  ar: string;
  // What this pattern is for, for the model's choice and for the team.
  fits: string;
  // When not to use it.
  avoid: string;
  templates: readonly TemplateId[];
}

export const PATTERNS = {
  studio_site: {
    kind: "website",
    en: "Service or company website",
    ar: "موقع شركة أو جهة خدمات",
    fits: "a company presenting its services and taking inquiries",
    avoid: "a product people sign up to use (use the SaaS pattern) or online booking of a time (use the booking pattern)",
    templates: ["hero", "value_points", "services", "how_it_works", "proof", "faq", "contact_cta"],
  },
  saas_marketing: {
    kind: "website",
    en: "SaaS marketing website",
    ar: "موقع تسويقي لمنتج برمجي",
    fits: "a software product explaining its value and converting sign-ups",
    avoid: "the product itself (a web application pattern) or a services company",
    templates: ["hero", "value_points", "how_it_works", "proof", "faq", "contact_cta"],
  },
  marketplace_site: {
    kind: "website",
    en: "Marketplace website",
    ar: "موقع سوق إلكتروني",
    fits: "listings from many providers that visitors browse and request",
    avoid: "a single business's own catalogue (use the service or booking pattern) or the operators' back office (marketplace administration)",
    templates: ["hero", "catalogue", "how_it_works", "confirmation", "proof", "faq", "contact_cta"],
  },
  academy_site: {
    kind: "website",
    en: "Academy website",
    ar: "موقع أكاديمية أو منصة تعليمية",
    fits: "courses or programmes that learners browse and apply to",
    avoid: "a learning platform with accounts, lessons and progress (a web or mobile application)",
    templates: ["hero", "course_list", "how_it_works", "proof", "faq", "contact_cta"],
  },
  booking_site: {
    kind: "website",
    en: "Booking or service business website",
    ar: "موقع حجز لنشاط خدمي",
    fits: "a local service business where visitors choose a service and book a time",
    avoid: "staff managing many calendars and resources (use the scheduling system)",
    templates: ["hero", "services", "booking_form", "confirmation", "how_it_works", "faq", "contact_cta"],
  },
  dashboard_app: {
    kind: "web_app",
    en: "Operational dashboard",
    ar: "لوحة متابعة تشغيلية",
    fits: "people who monitor activity and act on what needs attention",
    avoid: "a team that mainly moves records through stages (use CRM or workflow)",
    templates: ["overview_dashboard", "trend_report", "record_table", "record_detail", "data_form", "empty_state"],
  },
  crm_app: {
    kind: "web_app",
    en: "CRM or workflow system",
    ar: "نظام علاقات عملاء أو سير عمل",
    fits: "a team tracking customers, cases, requests or jobs through stages and the next action on each",
    avoid: "a public website, or a system centred on appointments (use the scheduling system)",
    templates: ["record_table", "record_detail", "workflow_board", "data_form", "overview_dashboard", "empty_state"],
  },
  marketplace_admin: {
    kind: "web_app",
    en: "Marketplace administration",
    ar: "إدارة سوق إلكتروني",
    fits: "operators who manage providers, listings and orders",
    avoid: "the public side of the marketplace (marketplace website or mobile patterns)",
    templates: ["overview_dashboard", "record_table", "record_detail", "catalogue", "data_form", "confirmation"],
  },
  scheduling_app: {
    kind: "web_app",
    en: "Scheduling system",
    ar: "نظام مواعيد وجدولة",
    fits: "staff and customers booking and managing appointments, rooms or resources",
    avoid: "a single page where visitors only request a time (booking website)",
    templates: ["schedule_calendar", "booking_form", "confirmation", "record_table", "record_detail", "how_it_works"],
  },
  mobile_onboarding: {
    kind: "mobile_app",
    en: "Mobile onboarding and account",
    ar: "تطبيق جوّال: البدء والحساب",
    fits: "a phone app whose first question is getting people started: welcome, first use, an empty start and the profile",
    avoid: "an app whose value is finding or ordering things (use the discovery or booking mobile patterns)",
    templates: ["onboarding", "home", "empty_state", "profile"],
  },
  mobile_discovery: {
    kind: "mobile_app",
    en: "Mobile discovery: list and detail",
    ar: "تطبيق جوّال: البحث والقوائم والتفاصيل",
    fits: "a phone app for finding things: a home, search and lists, and a detail page",
    avoid: "an app centred on placing and following an order or booking (use booking, order and tracking)",
    templates: ["home", "list_search", "detail", "empty_state"],
  },
  mobile_transactions: {
    kind: "mobile_app",
    en: "Mobile booking, order and tracking",
    ar: "تطبيق جوّال: الحجز والطلب والمتابعة",
    fits: "a phone app where people book or order, confirm, follow progress and manage their profile",
    avoid: "an app with no transaction (use discovery or onboarding)",
    templates: ["detail", "booking_order", "confirmation", "tracking", "profile"],
  },
} as const satisfies Record<string, Pattern>;

export type PatternId = keyof typeof PATTERNS;
export const PATTERN_IDS = Object.keys(PATTERNS) as PatternId[];

// Patterns from the first library version (Pack format 1). Never offered again;
// kept only so a stored first-version design can still be drawn in its history.
export const LEGACY_PATTERNS = {
  operations_app: { kind: "web_app", en: "Operations workflow", ar: "نظام تشغيل وسير عمل", templates: ["workflow_board", "record_table", "record_detail", "data_form", "overview_dashboard"] },
  mobile_app: { kind: "mobile_app", en: "Mobile application", ar: "تطبيق جوّال", templates: ["onboarding", "home", "list_search", "detail", "booking_order", "tracking", "profile"] },
} as const satisfies Record<string, Pick<Pattern, "kind" | "en" | "ar" | "templates">>;
export type LegacyPatternId = keyof typeof LEGACY_PATTERNS;

export const isPatternId = (value: unknown): value is PatternId => typeof value === "string" && Object.hasOwn(PATTERNS, value);
export const isTemplateId = (value: unknown): value is TemplateId => typeof value === "string" && Object.hasOwn(TEMPLATES, value);
export const isLegacyPatternId = (value: unknown): value is LegacyPatternId => typeof value === "string" && Object.hasOwn(LEGACY_PATTERNS, value);

// A pattern's name and templates, current or legacy (for drawing stored designs).
export const patternInfo = (id: string): Pick<Pattern, "kind" | "en" | "ar" | "templates"> | null => (isPatternId(id) ? PATTERNS[id] : isLegacyPatternId(id) ? LEGACY_PATTERNS[id] : null);

// The client's own answer on the form, as a project kind. "Not sure" and older
// values leave the choice to the pattern (or to manual preparation).
export function kindFromProjectType(projectType: string | null | undefined): ProjectKind | null {
  return projectType === "website" || projectType === "web_app" || projectType === "mobile_app" ? projectType : null;
}

// The catalogue as the prompt describes it.
export function catalogueText(): string {
  return PATTERN_IDS.map((id) => {
    const p = PATTERNS[id];
    return `- ${id} (${p.kind}): ${p.fits}. Not for: ${p.avoid}. Screen templates: ${p.templates.join(", ")}.`;
  }).join("\n");
}
