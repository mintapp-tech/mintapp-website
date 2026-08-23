import { describe, expect, test } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findInquiryIdByToken } from "./find-inquiry-by-token";

function fakeSupabase(existingId: string | null) {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async single() {
                  return { data: existingId ? { id: existingId } : null };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
}

describe("findInquiryIdByToken", () => {
  test("returns the id when a matching row exists", async () => {
    const id = await findInquiryIdByToken(fakeSupabase("found-id"), "tok-1");
    expect(id).toBe("found-id");
  });

  test("returns null when no matching row exists", async () => {
    const id = await findInquiryIdByToken(fakeSupabase(null), "tok-1");
    expect(id).toBeNull();
  });
});
