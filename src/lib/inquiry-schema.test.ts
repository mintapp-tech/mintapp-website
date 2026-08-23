import { describe, expect, test } from "vitest";
import { inquirySchema } from "./inquiry-schema";

const validBase = {
  name: "Jane Doe",
  email: "jane@example.com",
  desc: "A".repeat(50),
  lang: "en" as const,
  consent: true as const,
  submissionToken: "e8e7d808-9556-45b8-beae-49f852e98be9",
  formStartedAt: new Date().toISOString(),
  turnstileToken: "x".repeat(30),
};

describe("inquirySchema — turnstileToken bounds", () => {
  test("valid submission with a normal-length token passes", () => {
    expect(inquirySchema.safeParse(validBase).success).toBe(true);
  });

  test("empty turnstileToken is rejected", () => {
    expect(inquirySchema.safeParse({ ...validBase, turnstileToken: "" }).success).toBe(false);
  });

  test("missing turnstileToken is rejected", () => {
    const rest: Record<string, unknown> = { ...validBase };
    delete rest.turnstileToken;
    expect(inquirySchema.safeParse(rest).success).toBe(false);
  });

  test("turnstileToken at exactly 2048 chars is accepted (documented Cloudflare max)", () => {
    expect(inquirySchema.safeParse({ ...validBase, turnstileToken: "x".repeat(2048) }).success).toBe(true);
  });

  test("turnstileToken over 2048 chars is rejected (bounded, not unlimited)", () => {
    expect(inquirySchema.safeParse({ ...validBase, turnstileToken: "x".repeat(2049) }).success).toBe(false);
  });

  test("garbage (non-empty, in-bounds) turnstileToken passes schema — Cloudflare, not Zod, is the authority on validity", () => {
    expect(inquirySchema.safeParse({ ...validBase, turnstileToken: "not-a-real-token-just-garbage" }).success).toBe(true);
  });
});

describe("inquirySchema — honeypot is shape-only, never a schema rejection", () => {
  test("empty honeypot (legitimate user) passes and defaults to empty string", () => {
    const result = inquirySchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.honeypot).toBe("");
  });

  test("filled honeypot (bot signal) still passes schema shape validation — rejection is business logic, not a schema failure", () => {
    const result = inquirySchema.safeParse({ ...validBase, honeypot: "bot filled this in" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.honeypot).toBe("bot filled this in");
  });
});
