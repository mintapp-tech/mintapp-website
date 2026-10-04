// FIXTURES ONLY. Not client testimonials.
//
// Sample entries for the dev-only preview page and the tests, so the section's
// layout, approval gate and bilingual behaviour can be checked before any real
// client words exist. Never import this from a public page.

import type { Testimonial } from "./testimonials";

const approved = {
  approvedBy: "FIXTURE",
  approvedOn: "2026-01-01",
  quote: true,
  name: true,
  company: true,
  photo: false,
  logo: false,
  translation: true,
};

export const TESTIMONIAL_FIXTURES: Testimonial[] = [
  {
    id: "fixture-short-en",
    quote: "FIXTURE: a short sample quote for layout review. Not a real client testimonial.",
    quoteLanguage: "en",
    translation: { ar: "عيّنة اختبار: اقتباس قصير لمراجعة التصميم. ليس رأي عميل حقيقي." },
    author: { name: "Sample Client A", role: { en: "Founder", ar: "مؤسس" }, company: { en: "Example Co.", ar: "شركة مثال" } },
    project: "rentop",
    approval: approved,
  },
  {
    id: "fixture-long-ar",
    quote:
      "عيّنة اختبار: اقتباس أطول بالعربية لاختبار طول النص وتدفّقه في البطاقة على الشاشات الصغيرة والكبيرة، دون ترجمة معتمدة إلى الإنجليزية. ليس رأي عميل حقيقي.",
    quoteLanguage: "ar",
    author: { name: "Sample Client B", role: { en: "Operations lead", ar: "مسؤولة العمليات" }, company: { en: "Example Group", ar: "مجموعة مثال" } },
    approval: { ...approved, translation: false },
  },
  {
    id: "fixture-role-only",
    quote: "FIXTURE: attributed by role and company only, without a personal name. Not a real client testimonial.",
    quoteLanguage: "en",
    author: { role: { en: "Product manager", ar: "مدير منتج" }, company: { en: "Example Studio", ar: "استوديو مثال" } },
    approval: { ...approved, name: false, translation: false },
  },
];

// Entries the publication check must reject (used by tests).
export const UNPUBLISHABLE_FIXTURES: Testimonial[] = [
  { ...TESTIMONIAL_FIXTURES[0], id: "fixture-quote-not-approved", approval: { ...approved, quote: false } },
  { ...TESTIMONIAL_FIXTURES[0], id: "fixture-name-not-approved", approval: { ...approved, name: false } },
  { ...TESTIMONIAL_FIXTURES[0], id: "fixture-no-record", approval: { ...approved, approvedBy: "", approvedOn: "" } },
  { ...TESTIMONIAL_FIXTURES[0], id: "fixture-photo-not-approved", author: { ...TESTIMONIAL_FIXTURES[0].author, photo: "/x.jpg" } },
  { ...TESTIMONIAL_FIXTURES[2], id: "fixture-no-attribution", author: { role: { en: "Founder" } } },
  { ...TESTIMONIAL_FIXTURES[0], id: "fixture-translation-not-approved", approval: { ...approved, translation: false } },
  { ...TESTIMONIAL_FIXTURES[0], id: "fixture-empty", quote: "  " },
];
