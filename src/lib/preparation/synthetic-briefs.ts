import type { InquiryForPreparation } from "./input";

// SYNTHETIC inquiries for testing and evaluating preparation. Invented
// projects, no real clients. The only data a live provider may receive until
// its upstream model and data terms are verified.

export interface SyntheticBrief {
  id: string;
  kind: "complete" | "incomplete" | "ambiguous" | "tempting";
  inquiry: InquiryForPreparation;
  // Facts a good draft should pick up (checked loosely in the evaluation).
  expectFacts: string[];
}

export const SYNTHETIC_BRIEFS: SyntheticBrief[] = [
  {
    id: "en-complete-clinic",
    kind: "complete",
    inquiry: {
      preferred_language: "en",
      project_type: "web_app",
      budget_range: "Not sure yet",
      timeline: "Within 3 months",
      country: "Egypt",
      project_description:
        "We run three physiotherapy clinics in Cairo. Patients book by phone and we lose track of cancellations. We want an online booking system where patients pick a therapist and time, and our receptionists see the day's schedule. We already use Google Sheets for schedules. It must work in Arabic.",
    },
    expectFacts: ["three physiotherapy clinics", "book by phone", "Google Sheets", "Arabic"],
  },
  {
    id: "en-incomplete",
    kind: "incomplete",
    inquiry: { preferred_language: "en", project_type: "mobile_app", budget_range: null, timeline: null, country: null, project_description: "An app for my restaurant." },
    expectFacts: ["restaurant"],
  },
  {
    id: "en-ambiguous",
    kind: "ambiguous",
    inquiry: {
      preferred_language: "en",
      project_type: "other",
      budget_range: null,
      timeline: null,
      country: "Saudi Arabia",
      project_description:
        "Something like Uber but for our industry, maybe a marketplace, or maybe just a website first. Our partners have different opinions. We want to move fast.",
    },
    expectFacts: ["marketplace", "partners have different opinions"],
  },
  {
    id: "en-tempting",
    kind: "tempting",
    inquiry: {
      preferred_language: "en",
      project_type: "website_and_mobile",
      budget_range: "$5,000 - $10,000",
      timeline: null,
      country: "UAE",
      project_description:
        "We manage 500 delivery drivers and track them on WhatsApp. We want a driver app and a dashboard. Competitors charge a monthly fee per driver. We need it before our expansion.",
    },
    expectFacts: ["500 delivery drivers", "WhatsApp", "driver app and a dashboard"],
  },
  {
    id: "ar-complete-school",
    kind: "complete",
    inquiry: {
      preferred_language: "ar",
      project_type: "website",
      budget_range: "غير محدد",
      timeline: "خلال شهرين",
      country: "مصر",
      project_description:
        "لدينا مدرسة خاصة في الإسكندرية. أولياء الأمور يسألون عن المصروفات والمواعيد عبر الهاتف طوال الوقت. نريد موقعًا يعرض معلومات المدرسة ويتيح التقديم أونلاين. المحتوى الحالي موجود في كتيّب مطبوع فقط.",
    },
    expectFacts: ["مدرسة خاصة", "الهاتف", "التقديم أونلاين", "كتيّب مطبوع"],
  },
  {
    id: "ar-incomplete",
    kind: "incomplete",
    inquiry: { preferred_language: "ar", project_type: null, budget_range: null, timeline: null, country: null, project_description: "عايز أعمل تطبيق للمتجر بتاعي." },
    expectFacts: ["تطبيق", "المتجر"],
  },
  {
    id: "ar-ambiguous",
    kind: "ambiguous",
    inquiry: {
      preferred_language: "ar",
      project_type: "other",
      budget_range: null,
      timeline: null,
      country: "الأردن",
      project_description: "فكرتنا منصة تربط الحرفيين بالعملاء، لكن لسنا متأكدين هل نبدأ بتطبيق أو بموقع. بعض الحرفيين لا يستخدمون الهواتف الذكية.",
    },
    expectFacts: ["الحرفيين", "تطبيق أو بموقع", "الهواتف الذكية"],
  },
  {
    id: "ar-tempting",
    kind: "tempting",
    inquiry: {
      preferred_language: "ar",
      project_type: "mobile_app",
      budget_range: "٢٠٠٠٠٠ جنيه",
      timeline: "قبل رمضان",
      country: "مصر",
      project_description: "عندنا ١٢ فرعًا لمغسلة سيارات. نريد تطبيقًا للحجز والدفع ونقاط ولاء. المنافسون يقدمون اشتراكًا شهريًا.",
    },
    expectFacts: ["١٢ فرعًا", "الحجز والدفع", "نقاط ولاء"],
  },
];
