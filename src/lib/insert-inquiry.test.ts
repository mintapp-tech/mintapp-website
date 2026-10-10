import { describe, expect, test, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { insertInquiry } from "./insert-inquiry";
import type { InquiryInput } from "./inquiry-schema";

function fakeSupabaseForInsert(opts: { existingId?: string | null; insertError?: { code: string; message: string } | null }) {
  const calls: string[] = [];
  const client = {
    from() {
      return {
        select() {
          calls.push("select");
          return {
            eq() {
              return {
                async single() {
                  return { data: opts.existingId ? { id: opts.existingId } : null };
                },
              };
            },
          };
        },
        insert() {
          calls.push("insert");
          return {
            select() {
              return {
                async single() {
                  if (opts.insertError) return { data: null, error: opts.insertError };
                  return { data: { id: "new-id" }, error: null };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { calls, client };
}

const inquiryBody = {
  name: "Test",
  email: "test@example.com",
  desc: "desc",
  lang: "en",
  consent: true,
  submissionToken: "tok-1",
  formStartedAt: new Date().toISOString(),
  honeypot: "",
  turnstileToken: "x".repeat(21),
} as unknown as InquiryInput;

describe("insertInquiry", () => {
  test("successful insert returns inserted status with id", async () => {
    const { client } = fakeSupabaseForInsert({});
    const result = await insertInquiry(client, inquiryBody);
    expect(result).toEqual({ status: "inserted", id: "new-id" });
  });

  test("unique-violation (23505) on submission_token resolves via reactive lookup to duplicate", async () => {
    const { client } = fakeSupabaseForInsert({ existingId: "already-there", insertError: { code: "23505", message: "duplicate key" } });
    const result = await insertInquiry(client, inquiryBody);
    expect(result).toEqual({ status: "duplicate", id: "already-there" });
  });

  test("unrelated DB error is reported as failed, not swallowed", async () => {
    const { client } = fakeSupabaseForInsert({ insertError: { code: "23514", message: "check constraint violated" } });
    const result = await insertInquiry(client, inquiryBody);
    expect(result.status).toBe("failed");
  });
});

// A recording fake: each insert attempt returns the next scripted result and
// keeps the exact payload it was given.
function recordingSupabase(results: Array<{ error: { code: string; message: string } | null }>, existingId: string | null = null) {
  const payloads: Record<string, unknown>[] = [];
  const client = {
    from() {
      return {
        select() {
          return { eq: () => ({ single: async () => ({ data: existingId ? { id: existingId } : null }) }) };
        },
        insert(payload: Record<string, unknown>) {
          payloads.push(payload);
          const result = results[payloads.length - 1] ?? { error: null };
          return { select: () => ({ single: async () => (result.error ? { data: null, error: result.error } : { data: { id: "new-id" }, error: null }) }) };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { payloads, client };
}

describe("insertInquiry: project type", () => {
  test("stores the project type only when the client chose one", async () => {
    const { payloads, client } = recordingSupabase([{ error: null }]);
    await insertInquiry(client, { ...inquiryBody, projectType: "web_app" });
    expect(payloads[0].project_type).toBe("web_app");
  });

  test("an older form that sends nothing leaves project_type out entirely: nothing is guessed", async () => {
    const { payloads, client } = recordingSupabase([{ error: null }]);
    await insertInquiry(client, inquiryBody);
    expect(payloads[0]).not.toHaveProperty("project_type");
  });

  test("a database without the migration rejects not_sure: the inquiry is still stored, without the answer, and the log says so", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { payloads, client } = recordingSupabase([{ error: { code: "23514", message: 'new row violates check constraint "project_type_values"' } }, { error: null }]);
    const result = await insertInquiry(client, { ...inquiryBody, projectType: "not_sure" });
    expect(result).toEqual({ status: "inserted", id: "new-id" });
    expect(payloads).toHaveLength(2);
    expect(payloads[0].project_type).toBe("not_sure");
    expect(payloads[1]).not.toHaveProperty("project_type");
    expect(log).toHaveBeenCalledWith("project_type_rejected_by_database: stored the inquiry without it");
    log.mockRestore();
  });

  test("a different check violation is still a failure, not retried", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { payloads, client } = recordingSupabase([{ error: { code: "23514", message: 'violates check constraint "description_length"' } }]);
    const result = await insertInquiry(client, { ...inquiryBody, projectType: "website" });
    expect(result.status).toBe("failed");
    expect(payloads).toHaveLength(1);
    log.mockRestore();
  });

  test("a duplicate submission with a project type still resolves to the one existing inquiry", async () => {
    const { payloads, client } = recordingSupabase([{ error: { code: "23505", message: "duplicate key" } }], "already-there");
    const result = await insertInquiry(client, { ...inquiryBody, projectType: "mobile_app" });
    expect(result).toEqual({ status: "duplicate", id: "already-there" });
    expect(payloads).toHaveLength(1);
  });
  test("the campaign content identifier is stored when the visitor came from a tracked link, and only then", async () => {
    const { payloads, client } = recordingSupabase([{ error: null }, { error: null }]);
    await insertInquiry(client, { ...inquiryBody, utmContent: "flagship_en" });
    await insertInquiry(client, inquiryBody);
    expect(payloads[0].utm_content).toBe("flagship_en");
    expect(payloads[1]).not.toHaveProperty("utm_content");
  });

  test("a database without the utm_content column still stores the inquiry, without it", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { payloads, client } = recordingSupabase([{ error: { code: "PGRST204", message: "Could not find the 'utm_content' column of 'project_inquiries' in the schema cache" } }, { error: null }]);
    const result = await insertInquiry(client, { ...inquiryBody, utmContent: "flagship_en" });
    expect(result).toEqual({ status: "inserted", id: "new-id" });
    expect(payloads).toHaveLength(2);
    expect(payloads[1]).not.toHaveProperty("utm_content");
    log.mockRestore();
  });
  test("budget, timeline and the existing link go to their columns, and only when answered", async () => {
    const { payloads, client } = recordingSupabase([{ error: null }, { error: null }]);
    await insertInquiry(client, { ...inquiryBody, budget: "5000_10000", timeline: "within_3_months", existingUrl: "https://acme.example.com/" });
    await insertInquiry(client, inquiryBody);
    // Codes are stored, never labels.
    expect(payloads[0]).toMatchObject({ budget_range: "5000_10000", timeline: "within_3_months", company_url: "https://acme.example.com/" });
    for (const key of ["budget_range", "timeline", "company_url"]) expect(payloads[1]).not.toHaveProperty(key);
  });
});
