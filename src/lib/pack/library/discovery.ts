// Discovery banks: the topics a first meeting may need to cover, each with the
// reason to ask and example questions in both languages. Every discovery question in
// a Pack names its bank; examples are a starting point, never a script.

export interface DiscoveryBank {
  en: string;
  ar: string;
  why: string;
  examples: { en: string; ar: string }[];
}

export const DISCOVERY_BANKS = {
  project_type: {
    en: "Project type",
    ar: "نوع المشروع",
    why: "Whether this is a website, a web application, a mobile app or several, and which comes first.",
    examples: [
      { en: "What should people be able to do on the first day it is live?", ar: "ما الذي يجب أن يستطيع الناس فعله في أول يوم للإطلاق؟" },
      { en: "Is a website or an app the better first step for your customers?", ar: "هل الموقع أم التطبيق هو الخطوة الأولى الأنسب لعملائك؟" },
    ],
  },
  business_model: {
    en: "Business model",
    ar: "نموذج العمل",
    why: "How the product creates value and earns money, so scope supports the business.",
    examples: [
      { en: "How does this product earn money or save it?", ar: "كيف يحقق هذا المنتج دخلًا أو يوفّر تكلفة؟" },
      { en: "Who pays, and when?", ar: "من يدفع، ومتى؟" },
    ],
  },
  users: {
    en: "Users",
    ar: "المستخدمون",
    why: "Who uses it, what they do today instead, and what they need first.",
    examples: [
      { en: "Who will use this first, and what do they do today instead?", ar: "من سيستخدم المنتج أولًا، وماذا يفعل اليوم بدلًا منه؟" },
      { en: "Which group matters most for the first release?", ar: "أي فئة هي الأهم في الإصدار الأول؟" },
    ],
  },
  operations: {
    en: "Operations",
    ar: "التشغيل",
    why: "How the work actually runs today, step by step, and where it breaks.",
    examples: [
      { en: "Walk us through a normal day: where does it go wrong?", ar: "صف لنا يومًا عاديًا: أين تحدث المشكلات؟" },
      { en: "Who handles exceptions such as cancellations or returns?", ar: "من يتعامل مع الحالات الاستثنائية مثل الإلغاء أو الاسترجاع؟" },
    ],
  },
  payments: {
    en: "Payments",
    ar: "المدفوعات",
    why: "Whether money moves through the product, how, and in which currencies.",
    examples: [
      { en: "Should customers pay in the product, or is payment handled elsewhere?", ar: "هل يدفع العملاء داخل المنتج أم تتم المدفوعات بطريقة أخرى؟" },
      { en: "Which payment methods do your customers expect?", ar: "ما وسائل الدفع التي يتوقعها عملاؤك؟" },
    ],
  },
  integrations: {
    en: "Integrations",
    ar: "التكاملات",
    why: "Existing tools and data the product must work with or replace.",
    examples: [
      { en: "Which tools do you use today that this must connect to or replace?", ar: "ما الأدوات التي تستخدمونها اليوم ويجب أن يرتبط بها المنتج أو يحل محلها؟" },
      { en: "Is there existing data we need to bring in?", ar: "هل توجد بيانات حالية يجب نقلها؟" },
    ],
  },
  roles_permissions: {
    en: "Roles and permissions",
    ar: "الأدوار والصلاحيات",
    why: "Who can see and change what.",
    examples: [
      { en: "Which people on your team need different access?", ar: "من في فريقك يحتاج إلى صلاحيات مختلفة؟" },
      { en: "Is there anything only a manager should be able to do?", ar: "هل هناك ما يجب أن يقتصر على المدير؟" },
    ],
  },
  content: {
    en: "Content",
    ar: "المحتوى",
    why: "What text, images and media exist, who writes the rest, and in which languages.",
    examples: [
      { en: "What content exists today, and who will write what is missing?", ar: "ما المحتوى الموجود حاليًا، ومن سيكتب الناقص؟" },
      { en: "Do you have approved photos and brand material we can use?", ar: "هل لديكم صور ومواد هوية معتمدة يمكننا استخدامها؟" },
    ],
  },
  security_privacy: {
    en: "Security and privacy",
    ar: "الأمان والخصوصية",
    why: "What personal or sensitive data is involved and what rules apply to it.",
    examples: [
      { en: "What personal information will the product hold, and who may see it?", ar: "ما المعلومات الشخصية التي سيحتفظ بها المنتج، ومن يحق له الاطلاع عليها؟" },
      { en: "Are there rules in your sector about storing this data?", ar: "هل توجد قواعد في قطاعكم بشأن تخزين هذه البيانات؟" },
    ],
  },
  analytics: {
    en: "Analytics",
    ar: "التحليلات",
    why: "What the client needs to know after launch to decide what comes next.",
    examples: [
      { en: "After launch, what would you want to know every week?", ar: "بعد الإطلاق، ما الذي تريد معرفته كل أسبوع؟" },
      { en: "How will you know the first release worked?", ar: "كيف ستعرف أن الإصدار الأول نجح؟" },
    ],
  },
  language: {
    en: "Arabic and English",
    ar: "العربية والإنجليزية",
    why: "Which languages, for whom, and who reviews each.",
    examples: [
      { en: "Which languages do your users need, and is one the main one?", ar: "ما اللغات التي يحتاجها مستخدموك، وهل هناك لغة أساسية؟" },
      { en: "Who on your side will review the Arabic and English text?", ar: "من في فريقكم سيراجع النصوص العربية والإنجليزية؟" },
    ],
  },
  support_maintenance: {
    en: "Support and maintenance",
    ar: "الدعم والصيانة",
    why: "Who runs the product after launch and what help they need.",
    examples: [
      { en: "Who will run the product day to day after launch?", ar: "من سيدير المنتج يوميًا بعد الإطلاق؟" },
      { en: "What kind of help would you want after launch?", ar: "ما نوع المساعدة التي تريدها بعد الإطلاق؟" },
    ],
  },
} as const satisfies Record<string, DiscoveryBank>;

export type DiscoveryBankId = keyof typeof DISCOVERY_BANKS;
export const DISCOVERY_BANK_IDS = Object.keys(DISCOVERY_BANKS) as DiscoveryBankId[];
export const isDiscoveryBankId = (value: unknown): value is DiscoveryBankId => typeof value === "string" && Object.hasOwn(DISCOVERY_BANKS, value);

export function bankCatalogueText(): string {
  return DISCOVERY_BANK_IDS.map((id) => `- ${id}: ${DISCOVERY_BANKS[id].why}`).join("\n");
}
