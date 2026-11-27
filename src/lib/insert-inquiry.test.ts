import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
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

  test("budget, timeline and the existing link go to columns the table already has, and only when answered", async () => {
    const { payloads, client } = recordingSupabase([{ error: null }, { error: null }]);
    await insertInquiry(client, { ...inquiryBody, budget: "100000_250000", budgetCurrency: "EGP", timeline: "within_3_months", existingUrl: "https://acme.example.com/" });
    await insertInquiry(client, inquiryBody);
    expect(payloads[0]).toMatchObject({ budget_range: "100000_250000", timeline: "within_3_months", company_url: "https://acme.example.com/" });
    for (const key of ["budget_range", "timeline", "company_url"]) expect(payloads[1]).not.toHaveProperty(key);
    // Nothing about where the visitor is: no country, no address.
    for (const p of payloads) expect(Object.keys(p).filter((k) => /^(ip|ip_address|remote_ip|country|visitor_country|geo)$/i.test(k))).toEqual([]);
  });

  test("every column written is declared by the migrations in this repository", async () => {
    const { payloads, client } = recordingSupabase([{ error: null }]);
    await insertInquiry(client, { ...inquiryBody, phone: "+20 100", company: "Acme", projectType: "web_app", utmSource: "s", utmMedium: "m", utmCampaign: "c", budget: "not_sure", budgetCurrency: "EGP", timeline: "asap", existingUrl: "https://acme.example.com/" });
    const dir = join(process.cwd(), "supabase", "migrations");
    const sql = readdirSync(dir).map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
    for (const column of Object.keys(payloads[0])) expect(sql, column).toMatch(new RegExp(`^\\s*(add column if not exists\\s+)?${column}\\s+(text|uuid|boolean|timestamptz)|add column if not exists ${column}\\b`, "m"));
    expect(Object.keys(payloads[0])).not.toContain("budget_currency");
  });
});
