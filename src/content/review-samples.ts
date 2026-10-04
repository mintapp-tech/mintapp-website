import "server-only";
import type { Testimonial } from "./testimonials";

// Explicit, opt-in switch for showing labelled SAMPLE testimonials in their
// homepage position on a protected Vercel Preview, so the design can be
// reviewed before real client quotes exist.
//
// It is on only when BOTH hold:
//   - Vercel says this is a Preview deployment (VERCEL_ENV === "preview"), and
//   - the deployment's branch is listed below.
// Everywhere else (production, local builds, any other branch) it is off. It
// never depends on whether approved quotes exist. Remove the branch from the
// list before that branch is merged.
export const TESTIMONIAL_SAMPLE_BRANCHES: readonly string[] = ["feat/testimonials-portfolio"];

type Env = { VERCEL_ENV?: string; VERCEL_GIT_COMMIT_REF?: string; [key: string]: string | undefined };

export function testimonialSamplesEnabled(env: Env = process.env): boolean {
  return env.VERCEL_ENV === "preview" && TESTIMONIAL_SAMPLE_BRANCHES.includes(env.VERCEL_GIT_COMMIT_REF ?? "");
}

// Sample entries when the switch is on; null otherwise. Loaded lazily so the
// sample text is only ever read on the server, and only when enabled.
export async function reviewSampleTestimonials(env: Env = process.env): Promise<Testimonial[] | null> {
  if (!testimonialSamplesEnabled(env)) return null;
  const { TESTIMONIAL_FIXTURES } = await import("./testimonial-fixtures");
  return TESTIMONIAL_FIXTURES;
}
