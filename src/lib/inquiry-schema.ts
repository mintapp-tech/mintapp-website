import "server-only";
import { z } from "zod";
import { INQUIRY_LIMITS } from "./inquiry-limits";
import { PROJECT_TYPES } from "./project-types";
import { BUDGET_ACCEPTED, TIMELINE_ACCEPTED, storedBudget, storedTimeline } from "./form-options";
import type { BudgetCurrency } from "./budget-currency";
import { EXISTING_LINK_MAX, normalizeExistingLink } from "./existing-link";

// Server-side source of truth. This schema only validates *shape* — the
// honeypot deliberately accepts any string here rather than enforcing
// max(0). The "must be empty" rule is a business-logic check the route runs
// itself, one step after this schema, on the already-parsed, typed value.
// If Zod rejected a filled honeypot directly, a bot would see that
// rejection in the field-error response and learn the honeypot exists —
// exactly what it's meant to avoid.
//
// Unknown fields are stripped (Zod's default for z.object()), not rejected:
// the insert object sent to Supabase is always built field-by-field from the
// parsed, typed result below — raw input is never spread into it — so a
// stray/extra field from a lagging client can never reach the database
// either way. Stripping just avoids a hard 400 for something harmless.
const inquiryFields = z.object({
  name: z.string().trim().min(INQUIRY_LIMITS.nameMin).max(INQUIRY_LIMITS.nameMax),
  email: z.string().trim().toLowerCase().max(INQUIRY_LIMITS.emailMax).email(),
  desc: z.string().trim().min(INQUIRY_LIMITS.descMin).max(INQUIRY_LIMITS.descMax),
  lang: z.enum(["en", "ar"]),
  // The form always sends it. It stays optional here only so an older cached
  // copy of the form (which has no such question) still gets through; when it
  // is present it must be exactly one of the four known values. A missing
  // value is stored as "not provided", never guessed from the brief.
  projectType: z.enum(PROJECT_TYPES).optional(),
  consent: z.literal(true),
  submissionToken: z.string().uuid(),
  formStartedAt: z.string().datetime(),
  honeypot: z.string().optional().default(""),
  // Cloudflare documents Turnstile tokens as up to 2048 characters — bounded
  // here rather than accepted as an unlimited string.
  turnstileToken: z.string().min(1).max(2048),
  company: z.string().trim().max(INQUIRY_LIMITS.companyMax).optional(),
  phone: z.string().trim().max(INQUIRY_LIMITS.phoneMax).optional(),
  utmSource: z.string().trim().max(INQUIRY_LIMITS.utmMax).optional(),
  utmMedium: z.string().trim().max(INQUIRY_LIMITS.utmMax).optional(),
  utmCampaign: z.string().trim().max(INQUIRY_LIMITS.utmMax).optional(),
  utmContent: z.string().trim().max(INQUIRY_LIMITS.utmMax).optional(),
  // Budget, timeline and the existing link: the current form always sends the
  // first two; all three stay optional so an older cached form still gets through.
  // Today's codes and the labels older review builds sent are both accepted, and
  // become what is stored (a code whenever the meaning is exact: form-options.ts).
  // The budget's currency is never taken from the client: a "budgetCurrency" field
  // (sent by an earlier review build) is stripped like any unknown field, and the
  // range is checked below against the currency the server derived.
  budget: z.enum(BUDGET_ACCEPTED).optional(),
  timeline: z.enum(TIMELINE_ACCEPTED).transform((v) => storedTimeline(v)!).optional(),
  // Stored normalized (https://..., no fragment); unsafe or unusable links are refused.
  existingUrl: z
    .string()
    .trim()
    .max(EXISTING_LINK_MAX)
    .optional()
    .transform((v, ctx) => {
      if (!v) return undefined;
      const normalized = normalizeExistingLink(v);
      if (!normalized) {
        ctx.addIssue({ code: "custom", message: "invalid_url" });
        return z.NEVER;
      }
      return normalized;
    }),
});

// The schema for one request. `currency` is what the server derived for that
// request (budget-currency.ts): a range from the other scale is refused with
// "budget_reload" (the visitor's page no longer matches what the server shows; a
// reload shows the right options). The result carries what is stored: the range
// code (or an older label kept as sent) and the derived currency.
export function inquirySchemaFor(currency: BudgetCurrency) {
  return inquiryFields.transform((v, ctx) => {
    if (v.budget === undefined) return { ...v, budgetCurrency: undefined };
    const stored = storedBudget(v.budget, currency);
    if (!stored) {
      ctx.addIssue({ code: "custom", path: ["budget"], message: "budget_reload" });
      return z.NEVER;
    }
    return { ...v, budget: stored.range, budgetCurrency: stored.currency };
  });
}

export type InquiryInput = z.output<ReturnType<typeof inquirySchemaFor>>;
