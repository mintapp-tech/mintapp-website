import { describe, expect, test } from "vitest";
import { TESTIMONIAL_SAMPLE_BRANCHES, reviewSampleTestimonials, testimonialSamplesEnabled } from "./review-samples";

const branch = TESTIMONIAL_SAMPLE_BRANCHES[0];

describe("testimonial review samples switch", () => {
  test("off by default: local development, local builds and tests", () => {
    expect(testimonialSamplesEnabled({})).toBe(false);
    expect(testimonialSamplesEnabled({ VERCEL_GIT_COMMIT_REF: branch })).toBe(false);
  });

  test("never in production, even for an opted-in branch", () => {
    expect(testimonialSamplesEnabled({ VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: branch })).toBe(false);
    expect(testimonialSamplesEnabled({ VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" })).toBe(false);
  });

  test("off on Previews of branches that did not opt in", () => {
    expect(testimonialSamplesEnabled({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "main" })).toBe(false);
    expect(testimonialSamplesEnabled({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "feat/something-else" })).toBe(false);
    expect(testimonialSamplesEnabled({ VERCEL_ENV: "preview" })).toBe(false);
    expect(testimonialSamplesEnabled({ VERCEL_ENV: "development", VERCEL_GIT_COMMIT_REF: branch })).toBe(false);
  });

  test("on only for a Vercel Preview of an opted-in branch, and returns labelled samples", async () => {
    const env = { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: branch };
    expect(testimonialSamplesEnabled(env)).toBe(true);
    const samples = await reviewSampleTestimonials(env);
    expect(samples?.length).toBeGreaterThan(0);
    for (const s of samples!) expect(JSON.stringify(s)).toMatch(/FIXTURE|fictional|عيّنة اختبار|وهمي/);
    expect(await reviewSampleTestimonials({ VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: branch })).toBeNull();
  });
});
