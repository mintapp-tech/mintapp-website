import type { TemplateId } from "./library";
import type { ArtifactKind, SectionKey, StatementBasis } from "./schema";

// What people read for each part of a Pack, in English and Arabic: the founders in
// the dashboard (in the interface language) and the client in the Direction Pack (in
// the Pack's own language). Internal names never appear on screen.

export type Lang = "en" | "ar";

export const ARTIFACT_NAMES: Record<Lang, Record<ArtifactKind, string>> = {
  en: { design: "Initial product direction", proposal: "Draft scope and proposal direction", discovery: "Discovery and meeting plan" },
  ar: { design: "الاتجاه المبدئي للمنتج", proposal: "مسودة النطاق واتجاه العرض", discovery: "خطة الاستكشاف والاجتماع" },
};

export const SECTION_LABELS: Record<Lang, Record<SectionKey, string>> = {
  en: {
    client_facts: "What the client told us",
    assumptions: "Our assumptions",
    missing_information: "What we still need to learn",
    business_context: "The business",
    users: "Who it is for",
    problem: "The problem",
    goals: "Goals",
    design_blueprint: "Product direction",
    screens: "Concept screens",
    user_flow: "Main user journey",
    scope_direction: "Recommended first release",
    proposal_direction: "Proposal direction",
    discovery_questions: "Questions for the meeting",
    decisions_needed: "Decisions the client needs to make",
    risks: "Risks and constraints",
    meeting_agenda: "Meeting agenda",
    next_steps: "Next steps",
  },
  ar: {
    client_facts: "ما أخبرنا به العميل",
    assumptions: "افتراضاتنا",
    missing_information: "ما زلنا بحاجة إلى معرفته",
    business_context: "النشاط",
    users: "لمن هو",
    problem: "المشكلة",
    goals: "الأهداف",
    design_blueprint: "اتجاه المنتج",
    screens: "شاشات مبدئية",
    user_flow: "رحلة المستخدم الرئيسية",
    scope_direction: "الإصدار الأول المقترح",
    proposal_direction: "اتجاه العرض",
    discovery_questions: "أسئلة للاجتماع",
    decisions_needed: "قرارات على العميل اتخاذها",
    risks: "المخاطر والقيود",
    meeting_agenda: "جدول الاجتماع",
    next_steps: "الخطوات التالية",
  },
};

export const BASIS_LABELS: Record<Lang, Record<StatementBasis, string>> = {
  en: { client_fact: "Client said", assumption: "Our assumption", recommendation: "Our recommendation", question: "To confirm" },
  ar: { client_fact: "قاله العميل", assumption: "افتراض منّا", recommendation: "توصيتنا", question: "للتأكيد" },
};

export type FieldKey =
  | "pattern"
  | "unsupported"
  | "direction"
  | "hierarchy"
  | "responsive"
  | "brand"
  | "first_release"
  | "later"
  | "not_included"
  | "proposal_pattern"
  | "approach"
  | "phases"
  | "deliverables"
  | "factors"
  | "evidence"
  | "reason"
  | "purpose"
  | "why"
  | "topic"
  | "screen";

export const FIELD_LABELS: Record<Lang, Record<FieldKey, string>> = {
  en: {
    pattern: "Product pattern",
    unsupported: "No library pattern fits",
    direction: "Direction",
    hierarchy: "What matters most, in order",
    responsive: "On phones and desktops",
    brand: "Brand material",
    first_release: "First release",
    later: "Later",
    not_included: "Not in the first release",
    proposal_pattern: "Kind of proposal",
    approach: "Approach",
    phases: "Phases",
    deliverables: "Deliverables",
    factors: "What will shape cost and schedule",
    evidence: "In their words",
    reason: "Why we think so",
    purpose: "Why we ask",
    why: "Why",
    topic: "Topic",
    screen: "Screen",
  },
  ar: {
    pattern: "نمط المنتج",
    unsupported: "لا يناسبه أي نمط في المكتبة",
    direction: "الاتجاه",
    hierarchy: "الأهم أولًا",
    responsive: "على الجوال والحاسوب",
    brand: "مواد الهوية",
    first_release: "الإصدار الأول",
    later: "لاحقًا",
    not_included: "خارج الإصدار الأول",
    proposal_pattern: "نوع العرض",
    approach: "المنهج",
    phases: "المراحل",
    deliverables: "المخرجات",
    factors: "ما سيحدد التكلفة والجدول الزمني",
    evidence: "بكلماتهم",
    reason: "لماذا نعتقد ذلك",
    purpose: "لماذا نسأل",
    why: "السبب",
    topic: "الموضوع",
    screen: "الشاشة",
  },
};

export const TEMPLATE_LABELS: Record<Lang, Record<TemplateId, string>> = {
  en: {
    hero: "Opening view",
    value_points: "Value points",
    services: "Services",
    how_it_works: "How it works",
    catalogue: "Listings",
    course_list: "Courses or programmes",
    booking_form: "Booking form",
    proof: "Proof points",
    faq: "Questions",
    contact_cta: "Call to action",
    overview_dashboard: "Overview dashboard",
    trend_report: "Trend report",
    record_table: "Record list",
    record_detail: "Record detail",
    workflow_board: "Workflow board",
    schedule_calendar: "Schedule",
    data_form: "Form",
    empty_state: "Empty state",
    confirmation: "Confirmation dialog",
    onboarding: "Onboarding",
    home: "Home",
    list_search: "Search and list",
    detail: "Detail",
    booking_order: "Booking or order",
    tracking: "Tracking",
    profile: "Profile",
  },
  ar: {
    hero: "الواجهة الافتتاحية",
    value_points: "نقاط القيمة",
    services: "الخدمات",
    how_it_works: "كيف يعمل",
    catalogue: "القوائم المعروضة",
    course_list: "الدورات أو البرامج",
    booking_form: "نموذج الحجز",
    proof: "نقاط الإثبات",
    faq: "الأسئلة",
    contact_cta: "دعوة لاتخاذ إجراء",
    overview_dashboard: "لوحة عامة",
    trend_report: "تقرير الاتجاه",
    record_table: "قائمة السجلات",
    record_detail: "تفاصيل السجل",
    workflow_board: "لوحة سير العمل",
    schedule_calendar: "الجدول",
    data_form: "نموذج",
    empty_state: "حالة فارغة",
    confirmation: "نافذة تأكيد",
    onboarding: "البدء",
    home: "الرئيسية",
    list_search: "البحث والقائمة",
    detail: "التفاصيل",
    booking_order: "الحجز أو الطلب",
    tracking: "المتابعة",
    profile: "الملف الشخصي",
  },
};
