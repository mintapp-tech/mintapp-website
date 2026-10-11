import type { TemplateId } from "./patterns";

// The building blocks of every concept screen: what each is for, the rules it
// follows, and where it is implemented (src/components/pack/templates.tsx and the
// frames in DesignPreview / the Direction Pack). A template is made of these; a
// model never names them.

export interface LibraryComponent {
  id: string;
  en: string;
  ar: string;
  purpose: string;
  rules: string[];
  // The internal part that draws it.
  part: string;
  // Templates that use it (empty for frame-level parts drawn around every screen).
  templates: TemplateId[];
}

export const COMPONENTS: LibraryComponent[] = [
  {
    id: "navigation",
    en: "Navigation",
    ar: "التنقل",
    purpose: "Where am I, where can I go: a website top bar, an application side bar.",
    rules: ["Five main destinations at most; the current one is marked by more than colour.", "On phones a website bar collapses to a menu button; an application's side bar becomes a top bar."],
    part: "SiteNav (website frames), AppChrome (application screens)",
    templates: ["overview_dashboard", "trend_report", "record_table", "record_detail", "workflow_board", "schedule_calendar", "data_form", "empty_state"],
  },
  {
    id: "hero",
    en: "Hero",
    ar: "الواجهة الرئيسية",
    purpose: "The first view of a website: what this is, for whom, and the one next step.",
    rules: ["One headline, one supporting sentence, one primary action (a secondary one at most).", "No slogans the client did not approve; no invented proof in the hero."],
    part: "Hero",
    templates: ["hero"],
  },
  {
    id: "cards",
    en: "Cards",
    ar: "البطاقات",
    purpose: "A set of comparable things: services, values, listings.",
    rules: ["Same structure in every card of a set; a title and one short line.", "Three or four across on desktop, one column on phones."],
    part: "Cards, Catalogue",
    templates: ["value_points", "services", "catalogue", "course_list", "proof", "home"],
  },
  {
    id: "forms",
    en: "Forms",
    ar: "النماذج",
    purpose: "Collecting what is needed, and only that.",
    rules: ["Every field has a visible label; help text says why a field is asked.", "One column; the primary action at the end, full width on phones."],
    part: "Fields, FormSection, AppForm",
    templates: ["booking_form", "data_form", "booking_order"],
  },
  {
    id: "tables",
    en: "Tables and record lists",
    ar: "الجداول وقوائم السجلات",
    purpose: "Scanning and acting on many records.",
    rules: ["The record's name first, its status visible, its next action reachable.", "On phones rows stack; nothing scrolls sideways without a labelled region."],
    part: "Rows, Table",
    templates: ["record_table", "faq", "list_search", "schedule_calendar", "detail", "profile"],
  },
  {
    id: "filters",
    en: "Filters and search",
    ar: "التصفية والبحث",
    purpose: "Narrowing a list to what matters now.",
    rules: ["A search field and a few visible filters; the active filters are shown and can be cleared.", "Filters never hide that results exist elsewhere."],
    part: "FilterBar, the search field in MobileList",
    templates: ["record_table", "list_search"],
  },
  {
    id: "dashboards",
    en: "Dashboards",
    ar: "لوحات المتابعة",
    purpose: "What needs attention, then the detail behind it.",
    rules: ["Tiles name a measure and link to the records behind it; values in a concept are placeholders, never invented.", "Attention first: overdue and blocked before totals."],
    part: "Dashboard",
    templates: ["overview_dashboard"],
  },
  {
    id: "empty_states",
    en: "Empty states",
    ar: "الحالات الفارغة",
    purpose: "The first visit or a list with nothing in it yet.",
    rules: ["Say what will appear here and give the first action.", "Never a blank area or a decorative illustration alone."],
    part: "EmptyState",
    templates: ["empty_state"],
  },
  {
    id: "dialogs",
    en: "Dialogs",
    ar: "مربعات الحوار",
    purpose: "Confirming a consequential step before it happens.",
    rules: ["Only for decisions with a consequence (paying, cancelling, deleting).", "The title says what will happen; the two actions say what they do, not 'OK' and 'Cancel'."],
    part: "Confirmation",
    templates: ["confirmation"],
  },
  {
    id: "mobile_navigation",
    en: "Mobile navigation",
    ar: "التنقل في الجوال",
    purpose: "Moving between the main areas of a phone app with one thumb.",
    rules: ["A bottom tab bar of three to five destinations with labels, not icons alone.", "Back is always available; nothing important sits behind a gesture only."],
    part: "MobileTabBar (phone frames of mobile patterns)",
    templates: [],
  },
  {
    id: "bookings",
    en: "Bookings",
    ar: "الحجوزات",
    purpose: "Choosing a service, a person and a time, and confirming it.",
    rules: ["Show what is available, not a blank calendar; confirm before committing.", "Times show their time zone when people may be in different places."],
    part: "FormSection, Calendar, Confirmation",
    templates: ["booking_form", "schedule_calendar", "booking_order", "confirmation"],
  },
  {
    id: "progress_status",
    en: "Progress and status",
    ar: "التقدم والحالة",
    purpose: "Where a request, order or case stands and what happens next.",
    rules: ["A status has a word, not only a colour; the next step is named.", "Steps read in the reader's direction."],
    part: "Steps, MobileTracking, Board",
    templates: ["how_it_works", "tracking", "workflow_board"],
  },
  {
    id: "data_visualisation",
    en: "Data visualisation",
    ar: "عرض البيانات",
    purpose: "A trend over time, only where a decision depends on it.",
    rules: ["Only when the client's decisions depend on a trend; a table is often clearer.", "In concepts, bars and lines are placeholders: no value, axis figure or growth claim is ever drawn."],
    part: "TrendReport",
    templates: ["trend_report"],
  },
];
