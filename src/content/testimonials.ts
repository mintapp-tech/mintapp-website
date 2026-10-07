// Client testimonials shown in "What our clients say".
//
// Only genuine, approved client words belong here. Approval to publish a
// project does not cover a quote, a name, a photo or a logo: each one needs its
// own approval, recorded below. An entry that fails the publication check is
// never shown, and the whole section stays hidden while nothing passes.

import type { SupportedLocale as Locale } from "@/lib/locales";

export type ProjectSlug = "arrentio" | "rentop" | "jameel" | "nazarih" | "taskaty" | "tanglevibe" | "kwayes";

type Localized = Partial<Record<Locale, string>>;

export interface Testimonial {
  id: string;
  // The quote exactly as approved, in the language the client wrote or said it.
  quote: string;
  quoteLanguage: Locale;
  // An approved translation for the other locale, if one exists. Without it,
  // the original quote is shown on both locales, marked with its language.
  translation?: Localized;
  author: {
    name?: string;
    role?: Localized;
    company?: Localized;
    // Path under /public, only used when approval.photo is true.
    photo?: string;
    // The company's own logo file, unaltered, under /public; only used when
    // approval.logo is true.
    logo?: { src: string; width: number; height: number };
  };
  // Optional link to the related case study.
  project?: ProjectSlug;
  approval: {
    // Who gave the approval and when (ISO date), for our records.
    approvedBy: string;
    approvedOn: string;
    quote: boolean;
    name: boolean;
    company: boolean;
    photo: boolean;
    logo: boolean;
    // Whether the translation (if any) was approved too.
    translation: boolean;
  };
}

// Each quote is reproduced exactly as approved, including its spelling.
export const TESTIMONIALS: readonly Testimonial[] = [
  {
    id: "otj-nour-makram",
    quote:
      "Working with MintApp team on OTJ has been a great experience. They helped turn a complex idea into a working platform, from creative profiles and client briefs to proposals, payments, and project tracking. What I appreciate most is their willingness to keep improving the product with us as we learn from real users. Building a startup means things evolve constantly, and they’ve been part of that journey.",
    quoteLanguage: "en",
    author: {
      name: "Nour Makram",
      // Nour is a woman: the Arabic title is feminine.
      role: { en: "Founder", ar: "المؤسِّسة" },
      company: { en: "OTJ", ar: "OTJ" },
      // OTJ's own logo from onetimejob.co, unaltered.
      logo: { src: "/testimonials/otj-logo.png", width: 233, height: 70 },
    },
    approval: { approvedBy: "Nour Makram, Founder of OTJ (relayed by Omar)", approvedOn: "2026-10-05", quote: true, name: true, company: true, photo: false, logo: true, translation: false },
  },
  {
    id: "al-wakrah-academy-supervisor",
    quote:
      "What stood out about working with Mintapp was how well the team understood what we needed. They took our requirements seriously, handled the work professionally, and delivered a result we were happy with on the agreed timeline.",
    quoteLanguage: "en",
    author: {
      // No personal name. The attribution stays in its approved English
      // wording on both locales (an Arabic job title would assume a gender).
      role: { en: "Academy Supervisor" },
      company: { en: "Al Wakrah" },
    },
    approval: { approvedBy: "Academy Supervisor, Al Wakrah (relayed by Omar)", approvedOn: "2026-10-05", quote: true, name: false, company: true, photo: false, logo: false, translation: false },
  },
];

export type PublicationProblem =
  | "quote_not_approved"
  | "missing_approval_record"
  | "empty_quote"
  | "no_attribution"
  | "name_not_approved"
  | "company_not_approved"
  | "photo_not_approved"
  | "logo_not_approved"
  | "translation_not_approved";

// Every reason an entry may not be published. Empty means it can be shown.
export function publicationProblems(t: Testimonial): PublicationProblem[] {
  const problems: PublicationProblem[] = [];
  const a = t.approval;
  if (!a.approvedBy.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(a.approvedOn)) problems.push("missing_approval_record");
  if (!a.quote) problems.push("quote_not_approved");
  if (!t.quote.trim()) problems.push("empty_quote");
  if (t.author.name && !a.name) problems.push("name_not_approved");
  if (t.author.company && !a.company) problems.push("company_not_approved");
  if (t.author.photo && !a.photo) problems.push("photo_not_approved");
  if (t.author.logo && !a.logo) problems.push("logo_not_approved");
  if (t.translation && Object.keys(t.translation).length > 0 && !a.translation) problems.push("translation_not_approved");
  // Every quote needs an approved attribution: a name, or a role at a company.
  const hasRole = Boolean(t.author.role && Object.values(t.author.role).some(Boolean));
  if (!t.author.name && !(hasRole && t.author.company)) problems.push("no_attribution");
  return problems;
}

export function publishableTestimonials(all: readonly Testimonial[] = TESTIMONIALS): Testimonial[] {
  return all.filter((t) => publicationProblems(t).length === 0);
}

// What one card shows for a locale: the approved translation when there is
// one, otherwise the original words with their language marked.
export function testimonialForLocale(t: Testimonial, locale: Locale) {
  const translated = t.quoteLanguage !== locale ? t.translation?.[locale] : undefined;
  const pick = (value?: Localized) => value?.[locale] ?? value?.[t.quoteLanguage] ?? Object.values(value ?? {}).find(Boolean);
  return {
    id: t.id,
    quote: translated ?? t.quote,
    quoteLanguage: translated ? locale : t.quoteLanguage,
    name: t.author.name,
    role: pick(t.author.role),
    company: pick(t.author.company),
    photo: t.author.photo,
    logo: t.author.logo,
    project: t.project,
  };
}

export type TestimonialCard = ReturnType<typeof testimonialForLocale>;
