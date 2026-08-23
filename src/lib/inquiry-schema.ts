import "server-only";
import { z } from "zod";
import { INQUIRY_LIMITS } from "./inquiry-limits";

// Server-side source of truth. The honeypot must arrive and must be empty —
// any non-empty value is treated as a bot signal by the route, handled
// before this schema ever runs (see route.ts), not by failing validation
// here with a message a bot could learn from.
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
  honeypot: z.string().max(0).optional().default(""),
  company: z.string().trim().max(INQUIRY_LIMITS.companyMax).optional(),
  phone: z.string().trim().max(INQUIRY_LIMITS.phoneMax).optional(),
  utmSource: z.string().trim().max(INQUIRY_LIMITS.utmMax).optional(),
  utmMedium: z.string().trim().max(INQUIRY_LIMITS.utmMax).optional(),
  utmCampaign: z.string().trim().max(INQUIRY_LIMITS.utmMax).optional(),
});

export type InquiryInput = z.infer<typeof inquirySchema>;
