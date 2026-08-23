import { describe, expect, test } from "vitest";
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
