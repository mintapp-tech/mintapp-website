import "server-only";
import { z } from "zod";
import { INQUIRY_LIMITS } from "./inquiry-limits";

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
export const inquirySchema = z.object({
  name: z.string().trim().min(INQUIRY_LIMITS.nameMin).max(INQUIRY_LIMITS.nameMax),
  email: z.string().trim().toLowerCase().max(INQUIRY_LIMITS.emailMax).email(),
  desc: z.string().trim().min(INQUIRY_LIMITS.descMin).max(INQUIRY_LIMITS.descMax),
  lang: z.enum(["en", "ar"]),
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
});

export type InquiryInput = z.infer<typeof inquirySchema>;
