// A complete, valid Pack in Arabic for the synthetic crafts-platform fixture
// (11111111-...-004 in tests/fixtures/synthetic-inquiries.sql), as Claude would return
// it on the manual path. Invented content: no figure the brief does not state, every
// client fact quoting the brief.
export const craftsPack = {
  language: "ar",
  client_facts: [
    { text: "منصة تربط الحرفيين بالعملاء.", evidence: "منصة تربط الحرفيين بالعملاء" },
    { text: "بعض الحرفيين لا يستخدمون الهواتف الذكية.", evidence: "بعض الحرفيين لا يستخدمون الهواتف الذكية" },
  ],
  assumptions: [{ text: "يبحث العملاء عن الحرفيين حسب المنطقة.", reason: "المنصة تربط طرفين في أماكن مختلفة." }],
  missing_information: ["هل تبدأ المنصة بتطبيق أم بموقع؟"],
  business_context: [{ text: "منصة تربط الحرفيين بالعملاء.", basis: "client_fact", evidence: "منصة تربط الحرفيين بالعملاء" }],
  users: [
    { group: "العملاء", needs: "إيجاد حرفي مناسب.", basis: "assumption" },
    { group: "الحرفيون", needs: "الوصول إلى العملاء دون هاتف ذكي.", basis: "client_fact", evidence: "بعض الحرفيين لا يستخدمون الهواتف الذكية" },
  ],
  problem: [{ text: "لم يُحسم بعد هل البداية بتطبيق أم بموقع.", basis: "client_fact", evidence: "لسنا متأكدين هل نبدأ بتطبيق أو بموقع" }],
  goals: [{ text: "ربط الحرفيين بالعملاء.", basis: "client_fact", evidence: "منصة تربط الحرفيين بالعملاء" }],
  design_blueprint: {
    pattern: "marketplace_site",
    direction: "موقع يبدأ منه العميل بالبحث عن حرفي ويرسل طلبه بسهولة.",
    hierarchy: ["البحث", "الحرفيون", "الطلب"],
    responsive_notes: "الجوال أولًا لأن معظم العملاء يتصفحون من الهاتف.",
    brand_context: "لم تُذكر مواد للهوية.",
  },
  screens: [
    { id: "s1", template: "hero", title: "الرئيسية", purpose: "بدء البحث.", headline: "حرفيون قريبون منك", items: [], primary_action: "ابحث" },
    { id: "s2", template: "catalogue", title: "الحرفيون", purpose: "مقارنة الحرفيين.", headline: "الحرفيون", items: [{ title: "نجارة", text: "أعمال الخشب" }], primary_action: "اطلب" },
  ],
  user_flow: [
    { step: "يبدأ العميل البحث.", screen: "s1" },
    { step: "يختار حرفيًا ويطلبه.", screen: "s2" },
  ],
  scope_direction: { first_release: ["البحث عن الحرفيين", "إرسال الطلب"], later: ["تطبيق للحرفيين"], not_included: ["الدفع"] },
  proposal_direction: {
    pattern: "website",
    approach: "نبدأ بموقع بسيط لأن بعض الحرفيين لا يستخدمون الهواتف الذكية.",
    phases: [{ name: "الإصدار الأول", summary: "البحث والطلب." }],
    deliverables: ["تصميمات الصفحات", "الموقع"],
    cost_schedule_factors: ["عدد الحرفيين في البداية"],
  },
  discovery_questions: [
    { question: "كيف يصل الحرفيون إلى العملاء اليوم؟", purpose: "فهم الوضع الحالي.", bank: "operations" },
    { question: "من سيضيف بيانات الحرفيين؟", purpose: "تحديد المحتوى.", bank: "content" },
    { question: "هل يحتاج العملاء إلى الدفع عبر المنصة؟", purpose: "تحديد المدفوعات.", bank: "payments" },
  ],
  decisions_needed: ["البدء بموقع أم بتطبيق"],
  risks: [{ risk: "قد لا يستخدم بعض الحرفيين المنصة.", why: "لا يستخدمون الهواتف الذكية." }],
  meeting_agenda: [
    { item: "الفكرة", purpose: "تأكيد الفهم." },
    { item: "الخطوة التالية", purpose: "الاتفاق." },
  ],
  next_steps: ["نرسل اقتراحًا بعد الاجتماع."],
};
