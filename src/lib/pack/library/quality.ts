// Mintapp's quality rules for every Pack and Direction Pack: what we never do, how
// a version is judged, and what a founder confirms before approving. Where a rule can
// be checked by code it is (src/lib/pack/v2.ts); the rest is the reviewer's job, and
// the checklist below is shown at the moment of approval.

export type Check = "automatic" | "review" | "both";

export interface QualityRule {
  id: string;
  rule: string;
  why: string;
  check: Check;
  // How code enforces it, when it does.
  enforcement?: string;
}

export const QUALITY_RULES: QualityRule[] = [
  {
    id: "no_decoration",
    rule: "No random gradients, glass cards or decorative effects without a purpose.",
    why: "Decoration hides the structure the client needs to judge.",
    check: "automatic",
    enforcement: "Concepts are drawn only by library templates from text; nothing in a Pack can carry a style, colour or effect.",
  },
  {
    id: "no_invented_proof",
    rule: "No fake statistics, testimonials, users, clients or capabilities.",
    why: "A first direction must be something we can stand behind in the meeting.",
    check: "both",
    enforcement: "Any figure the client did not state is refused; claims such as 'trusted by', 'award-winning' or quotes from customers are refused.",
  },
  {
    id: "no_placeholder",
    rule: "No lorem ipsum, 'TBD', bracketed placeholders or test text in anything a client sees.",
    why: "Placeholder text in a client presentation reads as unfinished work.",
    check: "automatic",
    enforcement: "A version with placeholder text can be saved and reviewed, but the Direction Pack cannot be presented or exported from it.",
  },
  {
    id: "library_only",
    rule: "No interface pattern outside the library.",
    why: "What we show must be something we design and build well.",
    check: "automatic",
    enforcement: "Only library pattern, template, proposal-pattern and discovery-bank ids are accepted; anything else is refused or prepared by hand.",
  },
  {
    id: "feasible",
    rule: "No visually impressive but operationally impossible concept.",
    why: "The client will plan around what we show.",
    check: "review",
  },
  {
    id: "responsive",
    rule: "No desktop-only design.",
    why: "Most of our clients' customers arrive on phones.",
    check: "both",
    enforcement: "Every design states its responsive direction, and every web concept is drawn at desktop and phone width.",
  },
  {
    id: "arabic_review",
    rule: "No English layout simply mirrored without an Arabic review.",
    why: "Arabic readers notice translated layouts and copy immediately.",
    check: "both",
    enforcement: "A Pack is written wholly in the client's language (checked); a fluent reader approves the Arabic before presenting.",
  },
  {
    id: "calm_motion",
    rule: "No excessive animation.",
    why: "Motion distracts in a meeting and fails people with motion sensitivity.",
    check: "automatic",
    enforcement: "Concept screens and the Direction Pack are static.",
  },
  {
    id: "no_hidden_commitments",
    rule: "No proposal commitments disguised as assumptions.",
    why: "Scope, price and timeline are confirmed after discovery, in the final proposal.",
    check: "both",
    enforcement: "Promises, guarantees, fixed prices and delivery dates are refused anywhere in a Pack, assumptions included.",
  },
];

export interface RubricCriterion {
  id: string;
  en: string;
  ar: string;
  question: { en: string; ar: string };
}

// How a reviewer judges a version (and the Direction Pack as a whole).
export const RUBRIC: RubricCriterion[] = [
  { id: "relevance", en: "Relevance", ar: "الصلة بالعميل", question: { en: "Is every part about this client's business and words, not a generic template?", ar: "هل كل جزء يخص نشاط هذا العميل وكلماته، لا قالبًا عامًا؟" } },
  { id: "clarity", en: "Clarity", ar: "الوضوح", question: { en: "Would the client understand each slide in one reading?", ar: "هل سيفهم العميل كل شريحة من قراءة واحدة؟" } },
  { id: "differentiation", en: "Differentiation", ar: "التميّز", question: { en: "Does the direction show what would make this product right for this client, not just any product?", ar: "هل يبيّن الاتجاه ما يجعل هذا المنتج مناسبًا لهذا العميل تحديدًا؟" } },
  { id: "feasibility", en: "Feasibility", ar: "قابلية التنفيذ", question: { en: "Could we build and the client operate what is shown?", ar: "هل يمكننا بناء ما يُعرض، ويمكن للعميل تشغيله؟" } },
  { id: "consistency", en: "Consistency", ar: "الاتساق", question: { en: "Do the problem, screens, flow, scope and questions tell one story?", ar: "هل تروي المشكلة والشاشات والرحلة والنطاق والأسئلة قصة واحدة؟" } },
  { id: "accessibility", en: "Accessibility", ar: "إتاحة الوصول", question: { en: "Are labels, contrast and actions clear for everyone?", ar: "هل التسميات والتباين والإجراءات واضحة للجميع؟" } },
  { id: "responsiveness", en: "Responsiveness", ar: "التجاوب", question: { en: "Does it work on a phone as well as on a desktop?", ar: "هل يعمل على الجوال كما يعمل على الحاسوب؟" } },
  { id: "rtl", en: "Right to left", ar: "الاتجاه من اليمين إلى اليسار", question: { en: "If in Arabic: was it reviewed by a fluent reader, and does it read naturally right to left?", ar: "إن كان بالعربية: هل راجعه قارئ متمكّن، وهل يُقرأ بطبيعية من اليمين إلى اليسار؟" } },
  { id: "evidence", en: "Evidence", ar: "الدليل", question: { en: "Is each client fact really in the brief, and is every assumption marked as one?", ar: "هل كل معلومة منسوبة للعميل موجودة فعلًا في طلبه، وهل كل افتراض موسوم بأنه افتراض؟" } },
  { id: "usefulness", en: "Meeting usefulness", ar: "فائدة الاجتماع", question: { en: "Will this help us run a better first meeting and reach a decision?", ar: "هل يساعدنا هذا على إدارة اجتماع أول أفضل والوصول إلى قرار؟" } },
];

// Confirmed by the approving founder, shown beside the approve button.
export const APPROVAL_CHECKLIST: { id: string; en: string; ar: string }[] = [
  { id: "facts", en: "Every 'Client said' item is in the client's own brief.", ar: "كل ما وُسم «قاله العميل» موجود في طلب العميل نفسه." },
  { id: "assumptions", en: "Every assumption is marked as one, and none is a promise.", ar: "كل افتراض موسوم بأنه افتراض، ولا شيء منها وعد." },
  { id: "figures", en: "No price, date, duration or number appears that the client did not give.", ar: "لا يظهر سعر أو تاريخ أو مدة أو رقم لم يذكره العميل." },
  { id: "proof", en: "No invented users, statistics, testimonials or capabilities.", ar: "لا مستخدمين أو إحصاءات أو شهادات أو قدرات مختلَقة." },
  { id: "feasible", en: "We could build what is shown, and the client could run it.", ar: "يمكننا بناء ما يُعرض، ويمكن للعميل تشغيله." },
  { id: "language", en: "The language reads naturally (Arabic reviewed by a fluent reader).", ar: "اللغة طبيعية (والعربية راجعها قارئ متمكّن)." },
  { id: "not_final", en: "Nothing reads as a final quote, scope or timeline.", ar: "لا شيء يُفهم على أنه عرض سعر أو نطاق أو جدول زمني نهائي." },
];
