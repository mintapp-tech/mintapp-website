import type { Pack } from "@/lib/pack/schema";

// The curated review dataset: a small, readable, fictional set of leads for the
// synthetic review project (mintapp-review), one example for every workflow position
// the application has, and one complete successful case from inquiry to project.
// Every business, person and detail is invented; email addresses use the reserved
// .invalid domain and there are no phone numbers. The SQL that loads it
// (supabase/review/seed_curated.sql) is generated from this file by
// `npm run review:seed`, and the tests check every Pack in it with the application's
// own validator.

export const SEED_DOMAIN = "review-seed.invalid";
// Who "did" things in the seed: never a reviewer's real account, never a test sign-in.
export const SEED_OMAR = `omar@${SEED_DOMAIN}`;
export const SEED_ADAM = `adam@${SEED_DOMAIN}`;

export const seedId = (n: number) => `5eed0000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export interface SeedReview {
  to: "in_review" | "approved" | "draft";
  by: string;
}
export interface SeedVersion {
  artifact: "design" | "proposal" | "discovery";
  source: "manual" | "edited";
  author: string;
  content: unknown;
  reviews: SeedReview[];
}
export interface SeedProposal {
  fields: Record<string, string | number>;
  // In order, each by an actor (approval by the founder who did not write it).
  transitions: { to: "internal_review" | "approved" | "sent" | "accepted"; by: string }[];
}
export interface SeedLead {
  n: number;
  // What this lead demonstrates (also the order of the dataset).
  demonstrates: string;
  name: string;
  company: string | null;
  email: string;
  lang: "en" | "ar";
  projectType: "website" | "web_app" | "mobile_app" | "not_sure";
  description: string;
  budget: { range: string; currency: "USD" | "EGP" } | null;
  timeline: string | null;
  country: string;
  daysAgo: number;
  owners: ("omar" | "adam")[];
  booking?: { inDays: number; uid: string };
  // Database stages in order (each through the real stage function).
  stages: string[];
  loss?: { reason: string; note: string };
  priority?: "high" | "medium" | "low";
  pausedForDays?: number;
  followUp?: { action: string; owner: "omar" | "adam"; inDays: number };
  createCompany?: boolean;
  versions?: SeedVersion[];
  proposal?: SeedProposal;
  project?: { name: string; status: "planned" | "active" };
  contract?: { status: "signed"; signedDaysAgo: number; reference: string };
}
export interface SeedProspect {
  n: number;
  demonstrates: string;
  company: string;
  country: string;
  sector: string;
  pool: "warm" | "trigger_startup" | "operational_sme" | "referral_partner";
  contact: string;
  role: string;
  channel: "linkedin" | "email" | "introduction";
  language: "en" | "ar";
  trigger: string;
  owner: "omar" | "adam";
  stage: "researched" | "contacted" | "inquiry_submitted";
  followUp?: { action: string; inDays: number };
  touch?: { summary: string };
  linksTo?: number;
}

// ----- The complete successful case: Lotus Dental Care

const lotusBrief =
  "We run two dental clinics in Giza. Patients call to book and many appointments are missed because nobody reminds them. We want patients to book online and our front desk to see one schedule for both clinics. Some patients prefer Arabic, so it should work in both languages.";

export const lotusPack: Pack = {
  language: "en",
  client_facts: [
    { text: "Two dental clinics in Giza.", evidence: "We run two dental clinics in Giza." },
    { text: "Patients book by phone.", evidence: "Patients call to book" },
    { text: "Appointments are missed when nobody reminds patients.", evidence: "many appointments are missed because nobody reminds them" },
    { text: "It must work in Arabic and English.", evidence: "it should work in both languages" },
  ],
  assumptions: [
    { text: "Patients would read a reminder by text message.", reason: "The brief names missed appointments, not a channel." },
    { text: "Both clinics keep the same opening hours.", reason: "The brief asks for one schedule for both." },
  ],
  missing_information: ["How many dentists work at each clinic", "Whether patients pay anything when they book"],
  business_context: [
    { text: "A dental practice with two clinics in Giza.", basis: "client_fact", evidence: "We run two dental clinics in Giza." },
    { text: "One front desk handles bookings for both clinics.", basis: "assumption" },
  ],
  users: [
    { group: "Patients", needs: "Book a visit online and be reminded before it.", basis: "client_fact", evidence: "We want patients to book online" },
    { group: "Front desk", needs: "One schedule for both clinics.", basis: "client_fact", evidence: "our front desk to see one schedule for both clinics" },
  ],
  problem: [
    { text: "Appointments are missed because nobody reminds patients.", basis: "client_fact", evidence: "many appointments are missed because nobody reminds them" },
    { text: "Booking by phone keeps the front desk busy.", basis: "assumption" },
  ],
  goals: [
    { text: "Patients book online.", basis: "client_fact", evidence: "We want patients to book online" },
    { text: "Fewer missed appointments.", basis: "assumption" },
  ],
  design_blueprint: {
    pattern: "scheduling_app",
    direction: "A short booking flow for patients on their phones, a confirmation with a reminder, and one shared schedule for the front desk across both clinics.",
    hierarchy: ["Choose a clinic, a service and a time", "Confirm and get a reminder", "The front desk's day across both clinics", "One appointment and its changes"],
    responsive_notes: "Patients book on phones; the front desk works on a desktop schedule that also reads on a tablet.",
    brand_context: "No brand material is mentioned; neutral placeholders until the practice shares its logo and colours.",
  },
  screens: [
    { id: "s1", template: "booking_form", title: "Book a visit", purpose: "A patient chooses the clinic, the service and a time.", headline: "Book your dental visit", items: [{ title: "Clinic", text: "Choose the clinic nearest to you" }, { title: "Service", text: "Check-up, cleaning or treatment" }, { title: "Time", text: "Open times only" }], primary_action: "Continue" },
    { id: "s2", template: "confirmation", title: "Confirm", purpose: "The patient confirms and chooses a reminder.", headline: "Book this visit?", supporting_text: "You can change or cancel it later.", items: [{ title: "Clinic", text: "The clinic you chose" }, { title: "Reminder", text: "A message the day before" }], primary_action: "Confirm booking", secondary_action: "Change time" },
    { id: "s3", template: "schedule_calendar", title: "Today's schedule", purpose: "The front desk sees both clinics' day.", headline: "Today across both clinics", items: [{ title: "Morning", text: "Booked and open times" }, { title: "Missed", text: "Patients who did not arrive" }], primary_action: "Add a booking" },
    { id: "s4", template: "record_detail", title: "Appointment", purpose: "The front desk manages one appointment.", headline: "Appointment details", items: [{ title: "Patient", text: "Name and preferred language" }, { title: "Status", text: "Confirmed" }, { title: "Reminder", text: "Sent the day before" }], primary_action: "Reschedule", secondary_action: "Cancel" },
  ],
  user_flow: [
    { step: "The patient picks a clinic, a service and a time.", screen: "s1" },
    { step: "Confirms the visit and chooses a reminder.", screen: "s2" },
    { step: "The front desk sees the booking on the day's schedule.", screen: "s3" },
    { step: "The front desk reschedules or cancels when needed.", screen: "s4" },
  ],
  scope_direction: {
    first_release: ["Online booking for both clinics", "Confirmation and reminder messages", "One schedule for the front desk", "Arabic and English throughout"],
    later: ["Deposits when booking", "A patient account with visit history"],
    not_included: ["Dental records", "Billing and insurance"],
  },
  proposal_direction: {
    pattern: "web_app",
    approach: "Start with booking, reminders and the shared schedule: the steps where appointments are lost today. Records and billing stay in the practice's current systems.",
    phases: [
      { name: "Discovery and flows", summary: "Agree the booking rules and the reminder message with the front desk." },
      { name: "Design", summary: "The booking, confirmation and schedule screens in both languages." },
      { name: "First release", summary: "Build, test with the front desk and launch." },
    ],
    deliverables: ["Booking and schedule designs in Arabic and English", "The working web application", "Front desk accounts for both clinics"],
    cost_schedule_factors: ["How reminders are sent", "Whether existing appointments must be imported", "How many services and dentists the schedule must show"],
  },
  discovery_questions: [
    { question: "How do patients book today, and what happens when they cancel?", purpose: "Map the booking and cancellation rules.", bank: "operations" },
    { question: "Which reminder would your patients actually read?", purpose: "Choose the reminder channel.", bank: "users" },
    { question: "Should patients pay anything when they book?", purpose: "Decide whether payments belong in the first release.", bank: "payments" },
    { question: "Who at the front desk may change or cancel a booking?", purpose: "Agree the roles.", bank: "roles_permissions" },
    { question: "Who will review the Arabic and English text?", purpose: "Plan the bilingual review.", bank: "language" },
  ],
  decisions_needed: ["Which reminder channel to use", "Whether deposits come now or later"],
  risks: [
    { risk: "The front desk may keep the paper diary alongside the new schedule.", why: "A habit is hard to change without a clear switch-over day." },
    { risk: "Reminder messages may be charged per message.", why: "Some channels charge for each message sent." },
  ],
  meeting_agenda: [
    { item: "How booking works today", purpose: "Confirm the problem in your words." },
    { item: "The first direction", purpose: "Walk through the concept screens." },
    { item: "Open questions", purpose: "Decide the reminders and the roles." },
    { item: "Next step", purpose: "Agree what we prepare after the meeting." },
  ],
  next_steps: ["We send the final proposal and scope after the meeting.", "You share the practice's logo and the list of services."],
};

// The first version of the product direction (before Adam's edit): three screens,
// one goal fewer. The comparison on the Pack tab shows what changed.
export const lotusFirstDesign: Pack = {
  ...lotusPack,
  goals: lotusPack.goals.slice(0, 1),
  design_blueprint: { ...lotusPack.design_blueprint, hierarchy: lotusPack.design_blueprint.hierarchy.slice(0, 3) },
  screens: lotusPack.screens.slice(0, 3),
  user_flow: lotusPack.user_flow.slice(0, 3),
};

// ----- A Pack in review, in Arabic: Al Sanabel Bakery

const bakeryBrief =
  "عندنا مخبز في المنصورة ونستقبل الطلبات عبر واتساب، وكثيرًا ما تضيع الطلبات أو تتأخر. نريد تطبيقًا يطلب منه العملاء الخبز والحلويات ويحددون موعد الاستلام، ويعرف فريقنا الطلبات الجديدة فورًا.";

export const bakeryPack: Pack = {
  language: "ar",
  client_facts: [
    { text: "مخبز في المنصورة.", evidence: "عندنا مخبز في المنصورة" },
    { text: "تصل الطلبات عبر واتساب.", evidence: "نستقبل الطلبات عبر واتساب" },
    { text: "تضيع بعض الطلبات أو تتأخر.", evidence: "كثيرًا ما تضيع الطلبات أو تتأخر" },
  ],
  assumptions: [{ text: "يستلم معظم العملاء طلباتهم من المخبز.", reason: "يذكر الطلب موعد الاستلام ولا يذكر التوصيل." }],
  missing_information: ["هل يحتاج العملاء إلى الدفع داخل التطبيق؟"],
  business_context: [{ text: "مخبز يبيع الخبز والحلويات.", basis: "client_fact", evidence: "يطلب منه العملاء الخبز والحلويات" }],
  users: [
    { group: "العملاء", needs: "طلب الخبز والحلويات وتحديد موعد الاستلام.", basis: "client_fact", evidence: "ويحددون موعد الاستلام" },
    { group: "فريق المخبز", needs: "معرفة الطلبات الجديدة فورًا.", basis: "client_fact", evidence: "ويعرف فريقنا الطلبات الجديدة فورًا" },
  ],
  problem: [{ text: "تضيع الطلبات أو تتأخر عبر واتساب.", basis: "client_fact", evidence: "كثيرًا ما تضيع الطلبات أو تتأخر" }],
  goals: [{ text: "تطبيق للطلب وتحديد موعد الاستلام.", basis: "client_fact", evidence: "نريد تطبيقًا يطلب منه العملاء الخبز والحلويات" }],
  design_blueprint: {
    pattern: "mobile_transactions",
    direction: "تطبيق بسيط يختار فيه العميل طلبه وموعد الاستلام ويتابع حالته حتى يصبح جاهزًا.",
    hierarchy: ["اختيار الأصناف", "موعد الاستلام", "تأكيد الطلب", "متابعة الطلب"],
    responsive_notes: "تطبيق للجوال فقط؛ مهمة واحدة في كل شاشة والإجراء الرئيسي في الأسفل.",
    brand_context: "لم تُذكر مواد للهوية؛ تبقى الصور مؤقتة حتى يرسل المخبز شعاره.",
  },
  screens: [
    { id: "s1", template: "booking_order", title: "الطلب", purpose: "يختار العميل الأصناف وموعد الاستلام.", headline: "طلبك", items: [{ title: "الأصناف", text: "خبز وحلويات" }, { title: "الاستلام", text: "اختر الموعد" }], primary_action: "متابعة" },
    { id: "s2", template: "confirmation", title: "التأكيد", purpose: "يؤكد العميل الطلب قبل إرساله.", headline: "تأكيد الطلب؟", items: [{ title: "الاستلام", text: "الموعد الذي اخترته" }], primary_action: "أرسل الطلب", secondary_action: "عدّل" },
    { id: "s3", template: "tracking", title: "المتابعة", purpose: "يتابع العميل حالة طلبه.", headline: "حالة طلبك", items: [{ title: "استُلم", text: "وصل طلبك إلى المخبز" }, { title: "قيد التحضير", text: "نجهّز طلبك" }, { title: "جاهز", text: "يمكنك الاستلام" }] },
  ],
  user_flow: [
    { step: "يختار العميل الأصناف والموعد.", screen: "s1" },
    { step: "يؤكد الطلب.", screen: "s2" },
    { step: "يتابع الطلب حتى يصبح جاهزًا.", screen: "s3" },
  ],
  scope_direction: { first_release: ["الطلب وتحديد موعد الاستلام", "إشعار الفريق بالطلبات الجديدة", "متابعة حالة الطلب"], later: ["الدفع داخل التطبيق"], not_included: ["التوصيل للمنازل"] },
  proposal_direction: {
    pattern: "mobile_app",
    approach: "نبدأ بالطلب والاستلام ومتابعة الحالة، وهي المواضع التي تضيع فيها الطلبات اليوم.",
    phases: [
      { name: "الاستكشاف والمسارات", summary: "الاتفاق على الأصناف وقواعد الاستلام." },
      { name: "الإصدار الأول", summary: "تصميم التطبيق وبناؤه واختباره مع الفريق." },
    ],
    deliverables: ["تصميمات شاشات الطلب والمتابعة", "التطبيق للمنصات المتفق عليها", "شاشة للفريق تعرض الطلبات الجديدة"],
    cost_schedule_factors: ["المنصات المطلوبة", "هل يُضاف الدفع لاحقًا", "عدد الأصناف وطريقة تحديثها"],
  },
  discovery_questions: [
    { question: "كيف تستقبلون الطلبات اليوم، وأين تضيع؟", purpose: "فهم المشكلة كما تحدث.", bank: "operations" },
    { question: "هل يريد عملاؤكم الدفع داخل التطبيق؟", purpose: "تحديد مكان الدفع.", bank: "payments" },
    { question: "من في الفريق يتابع الطلبات الجديدة؟", purpose: "تحديد الأدوار.", bank: "roles_permissions" },
  ],
  decisions_needed: ["هل يُضاف التوصيل لاحقًا"],
  risks: [{ risk: "قد يستمر بعض العملاء في الطلب عبر واتساب.", why: "العادة الحالية سهلة لهم." }],
  meeting_agenda: [
    { item: "طريقة الطلب اليوم", purpose: "تأكيد المشكلة." },
    { item: "الاتجاه الأول", purpose: "مراجعة الشاشات المبدئية." },
  ],
  next_steps: ["نرسل العرض النهائي بعد الاجتماع."],
};

// ----- The dataset

const parts = (pack: Pack) => {
  const { language, client_facts, assumptions, missing_information, business_context, users, problem, goals, design_blueprint, screens, user_flow, scope_direction, proposal_direction, discovery_questions, decisions_needed, risks, meeting_agenda, next_steps } = pack;
  return {
    design: { format: "pack-design", v: 2, language, client_facts, assumptions, missing_information, business_context, users, problem, goals, blueprint: design_blueprint, screens, user_flow },
    proposal: { format: "pack-proposal", v: 2, language, scope_direction, proposal_direction },
    discovery: { format: "pack-discovery", v: 2, language, discovery_questions, decisions_needed, risks, meeting_agenda, next_steps },
  };
};

const lotus = parts(lotusPack);
const lotusFirst = parts(lotusFirstDesign);
const bakery = parts(bakeryPack);

export const SEED_LEADS: SeedLead[] = [
  {
    n: 1,
    demonstrates: "New, English, with a company, waiting for a response",
    name: "Nadia Haddad",
    company: "Cedar Physio Clinics",
    email: `nadia.haddad@${SEED_DOMAIN}`,
    lang: "en",
    projectType: "web_app",
    description: "We run three physiotherapy clinics. Patients book by phone and we lose track of cancellations. We want online booking and one schedule for our receptionists.",
    budget: { range: "100000_250000", currency: "EGP" },
    timeline: "within_3_months",
    country: "Egypt",
    daysAgo: 1,
    owners: [],
    stages: [],
  },
  {
    n: 2,
    demonstrates: "New, Arabic, no company, waiting for a response",
    name: "سارة منصور",
    company: null,
    email: `sara.mansour@${SEED_DOMAIN}`,
    lang: "ar",
    projectType: "website",
    description: "أعطي دروسًا خصوصية في الرياضيات وأريد موقعًا يعرض المواعيد المتاحة ويستقبل طلبات الحجز من أولياء الأمور.",
    budget: { range: "under_2500", currency: "USD" },
    timeline: "asap",
    country: "الأردن",
    daysAgo: 2,
    owners: [],
    stages: [],
  },
  {
    n: 3,
    demonstrates: "Reviewing, outbound (came from a prospect), high priority, a dated next action",
    name: "Ahmed Saleh",
    company: "Bluewater Couriers",
    email: `ahmed.saleh@${SEED_DOMAIN}`,
    lang: "en",
    projectType: "web_app",
    description: "We run a courier service in Alexandria and track deliveries on paper. We want a dashboard that shows every delivery and its driver.",
    budget: { range: "not_sure", currency: "EGP" },
    timeline: "3_to_6_months",
    country: "Egypt",
    daysAgo: 4,
    owners: ["adam"],
    stages: ["reviewing"],
    priority: "high",
    followUp: { action: "Reply with two questions about delivery areas", owner: "adam", inDays: 1 },
  },
  {
    n: 4,
    demonstrates: "Reviewing and paused until a date, Arabic, low priority",
    name: "يوسف عادل",
    company: "مكتبة الضياء",
    email: `youssef.adel@${SEED_DOMAIN}`,
    lang: "ar",
    projectType: "not_sure",
    description: "نملك مكتبة لبيع الكتب ونفكر في البيع أونلاين، لكننا لم نقرر بعد هل نبدأ بموقع أو تطبيق.",
    budget: null,
    timeline: "over_6_months",
    country: "مصر",
    daysAgo: 9,
    owners: ["omar"],
    stages: ["reviewing"],
    priority: "low",
    pausedForDays: 14,
  },
  {
    n: 5,
    demonstrates: "Meeting booked, Arabic, the Pre-meeting Pack in review",
    name: "منى رمضان",
    company: "مخبز السنابل",
    email: `mona.ramadan@${SEED_DOMAIN}`,
    lang: "ar",
    projectType: "mobile_app",
    description: bakeryBrief,
    budget: { range: "100000_250000", currency: "EGP" },
    timeline: "within_3_months",
    country: "مصر",
    daysAgo: 3,
    owners: ["omar"],
    booking: { inDays: 2, uid: "seed-sanabel-1" },
    stages: ["meeting_booked"],
    versions: [
      { artifact: "design", source: "manual", author: SEED_OMAR, content: bakery.design, reviews: [{ to: "in_review", by: SEED_OMAR }] },
      { artifact: "proposal", source: "manual", author: SEED_OMAR, content: bakery.proposal, reviews: [] },
      { artifact: "discovery", source: "manual", author: SEED_OMAR, content: bakery.discovery, reviews: [{ to: "in_review", by: SEED_OMAR }, { to: "approved", by: SEED_ADAM }] },
    ],
  },
  {
    n: 6,
    demonstrates: "Qualified after the meeting, English, no company",
    name: "Karim Nassar",
    company: null,
    email: `karim.nassar@${SEED_DOMAIN}`,
    lang: "en",
    projectType: "website",
    description: "I sell scheduling software for gyms and need a website that explains it and lets gym owners start a trial.",
    budget: { range: "5000_10000", currency: "USD" },
    timeline: "within_3_months",
    country: "United Arab Emirates",
    daysAgo: 12,
    owners: ["omar"],
    booking: { inDays: -5, uid: "seed-nassar-1" },
    stages: ["meeting_booked", "meeting_completed", "qualified"],
  },
  {
    n: 7,
    demonstrates: "Proposal sent, English, with a company",
    name: "Laila Hamdi",
    company: "Atlas Learning Academy",
    email: `laila.hamdi@${SEED_DOMAIN}`,
    lang: "en",
    projectType: "website",
    description: "We run evening courses for adults and want a website where learners browse courses and apply online.",
    budget: { range: "2500_5000", currency: "USD" },
    timeline: "within_3_months",
    country: "Saudi Arabia",
    daysAgo: 20,
    owners: ["adam"],
    booking: { inDays: -10, uid: "seed-atlas-1" },
    stages: ["meeting_booked", "meeting_completed", "qualified", "proposal_prep", "proposal_sent"],
    proposal: {
      fields: { summary: "A course website with online applications.", recommended_scope: "Course pages, an application form and an admin list of applications.", deliverables: "Designs, the built website, content entry for the first courses.", exclusions: "Payments and a learner portal.", assumptions: "The academy provides course descriptions.", timeline_weeks_min: 6, timeline_weeks_max: 8, price_min: 4000, price_max: 4800, currency: "USD" },
      transitions: [
        { to: "internal_review", by: SEED_ADAM },
        { to: "approved", by: SEED_OMAR },
        { to: "sent", by: SEED_ADAM },
      ],
    },
  },
  {
    n: 8,
    demonstrates: "Decision (negotiation), Arabic, two owners",
    name: "هالة سمير",
    company: "شركة الواحة للتوريدات",
    email: `hala.samir@${SEED_DOMAIN}`,
    lang: "ar",
    projectType: "web_app",
    description: "نوزّع مستلزمات المكاتب على الشركات ونريد نظامًا يتابع الطلبات من الاستلام حتى التسليم.",
    budget: { range: "250000_500000", currency: "EGP" },
    timeline: "3_to_6_months",
    country: "مصر",
    daysAgo: 30,
    owners: ["omar", "adam"],
    booking: { inDays: -18, uid: "seed-waha-1" },
    stages: ["meeting_booked", "meeting_completed", "qualified", "proposal_prep", "proposal_sent", "negotiation"],
    proposal: {
      fields: { summary: "نظام لمتابعة الطلبات من الاستلام حتى التسليم.", recommended_scope: "قائمة الطلبات ولوحة المراحل وتفاصيل الطلب.", deliverables: "التصميمات والنظام وحسابات الفريق.", exclusions: "الفوترة.", assumptions: "يزوّدنا العميل بقائمة المنتجات.", timeline_weeks_min: 10, timeline_weeks_max: 12, price_min: 300000, price_max: 360000, currency: "EGP" },
      transitions: [
        { to: "internal_review", by: SEED_OMAR },
        { to: "approved", by: SEED_ADAM },
        { to: "sent", by: SEED_OMAR },
      ],
    },
  },
  {
    n: 9,
    demonstrates: "The complete successful case: booked, Pack prepared, edited and approved by both founders, Direction Pack presented, meeting held, final proposal accepted, won, contract signed and converted to a project",
    name: "Dina Fawzy",
    company: "Lotus Dental Care",
    email: `dina.fawzy@${SEED_DOMAIN}`,
    lang: "en",
    projectType: "web_app",
    description: lotusBrief,
    budget: { range: "250000_500000", currency: "EGP" },
    timeline: "3_to_6_months",
    country: "Egypt",
    daysAgo: 40,
    owners: ["omar"],
    booking: { inDays: -25, uid: "seed-lotus-1" },
    stages: ["meeting_booked", "meeting_completed", "qualified", "proposal_prep", "proposal_sent", "won"],
    createCompany: true,
    versions: [
      { artifact: "design", source: "manual", author: SEED_OMAR, content: lotusFirst.design, reviews: [{ to: "in_review", by: SEED_OMAR }, { to: "draft", by: SEED_ADAM }] },
      { artifact: "proposal", source: "manual", author: SEED_OMAR, content: lotus.proposal, reviews: [{ to: "in_review", by: SEED_OMAR }, { to: "approved", by: SEED_ADAM }] },
      { artifact: "discovery", source: "manual", author: SEED_OMAR, content: lotus.discovery, reviews: [{ to: "in_review", by: SEED_OMAR }, { to: "approved", by: SEED_ADAM }] },
      { artifact: "design", source: "edited", author: SEED_ADAM, content: lotus.design, reviews: [{ to: "in_review", by: SEED_ADAM }, { to: "approved", by: SEED_OMAR }] },
    ],
    proposal: {
      fields: { summary: "Online booking, reminders and one shared schedule for both clinics.", recommended_scope: "Booking for both clinics, confirmations and reminders, the front desk schedule, Arabic and English.", deliverables: "Designs in both languages, the working web application, front desk accounts.", exclusions: "Dental records, billing and insurance.", assumptions: "Reminders by text message; the practice provides its services list.", timeline_weeks_min: 10, timeline_weeks_max: 14, price_min: 300000, price_max: 380000, currency: "EGP" },
      transitions: [
        { to: "internal_review", by: SEED_OMAR },
        { to: "approved", by: SEED_ADAM },
        { to: "sent", by: SEED_OMAR },
        { to: "accepted", by: SEED_OMAR },
      ],
    },
    contract: { status: "signed", signedDaysAgo: 5, reference: "MA-LOTUS-01" },
    project: { name: "Lotus Dental booking", status: "active" },
  },
  {
    n: 10,
    demonstrates: "Lost, English, with the reason",
    name: "Samir Aziz",
    company: "Brightpath Tutors",
    email: `samir.aziz@${SEED_DOMAIN}`,
    lang: "en",
    projectType: "mobile_app",
    description: "We connect students with tutors and want an app for booking lessons.",
    budget: { range: "10000_20000", currency: "USD" },
    timeline: "asap",
    country: "Kuwait",
    daysAgo: 35,
    owners: ["adam"],
    stages: ["reviewing", "lost"],
    loss: { reason: "chose_other", note: "Chose an in-house developer." },
  },
];

export const SEED_PROSPECTS: SeedProspect[] = [
  { n: 1, demonstrates: "Outbound prospect, researched", company: "Granite Fitness Studios", country: "Egypt", sector: "Fitness", pool: "operational_sme", contact: "Mona Saleh", role: "Owner", channel: "linkedin", language: "en", trigger: "Opening a second studio", owner: "adam", stage: "researched" },
  { n: 2, demonstrates: "Outbound prospect, contacted, with a touch and a dated next action", company: "Saffron Kitchen Group", country: "United Arab Emirates", sector: "Restaurants", pool: "trigger_startup", contact: "Rami Khoury", role: "Operations lead", channel: "linkedin", language: "en", trigger: "Hiring for online orders", owner: "omar", stage: "contacted", followUp: { action: "Send a short note on order tracking", inDays: 3 }, touch: { summary: "First message about how orders reach the kitchen" } },
  { n: 3, demonstrates: "Outbound prospect that became an inquiry (Bluewater Couriers)", company: "Bluewater Couriers", country: "Egypt", sector: "Logistics", pool: "operational_sme", contact: "Ahmed Saleh", role: "Founder", channel: "introduction", language: "en", trigger: "Deliveries tracked on paper", owner: "adam", stage: "inquiry_submitted", linksTo: 3 },
];
