import { afterEach, describe, expect, test, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendInquiryNotification, type EmailSender } from "./send-inquiry-notification";

afterEach(() => {
  vi.unstubAllEnvs();
});

const baseInput = {
  inquiryId: "inquiry-1",
  name: "Test",
  email: "test@example.com",
  lang: "en",
  desc: "desc",
};

function fakeSupabaseForNotification(opts: { updateError?: boolean } = {}) {
  const calls: { table: string; op: string; payload?: unknown }[] = [];
  const client = {
    from(table: string) {
      return {
        update(payload: unknown) {
          calls.push({ table, op: "update", payload });
          return {
            eq: async () => ({ error: opts.updateError ? new Error("update failed") : null }),
          };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { calls, client };
}

// Forces the fail-safe to resolve to "send" so these tests exercise Resend
// send-path behavior directly, independent of email-sending-mode.test.ts.
function allowSendMode() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("EMAIL_SENDING_MODE", "send");
  vi.stubEnv("INQUIRY_NOTIFICATION_FROM", "From <from@example.com>");
  vi.stubEnv("INQUIRY_NOTIFICATION_TO", "to@example.com");
  vi.stubEnv("INQUIRY_NOTIFICATION_REPLY_TO", "reply@example.com");
}

describe("sendInquiryNotification — real-email fail-safe", () => {
  test("disabled mode: Resend is never called, and status is written as the distinct 'disabled' value", async () => {
    vi.stubEnv("NODE_ENV", "development"); // unset EMAIL_SENDING_MODE -> disabled by default
    const { calls, client } = fakeSupabaseForNotification();
    let sendCalled = false;
    const sender: EmailSender = { emails: { send: async () => { sendCalled = true; return { data: null, error: null }; } } };
    const result = await sendInquiryNotification(client, sender, baseInput);
    expect(result).toBe("disabled");
    expect(sendCalled).toBe(false);
    expect(calls.length).toBe(1);
    expect(calls[0].payload).toEqual({ notification_status: "disabled" });
  });

  test("disabled mode never produces 'sent', 'failed', or leaves the row untouched (pending)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { calls, client } = fakeSupabaseForNotification();
    const sender: EmailSender = { emails: { send: async () => ({ data: null, error: null }) } };
    const result = await sendInquiryNotification(client, sender, baseInput);
    expect(result).not.toBe("sent");
    expect(result).not.toBe("send_failed");
    expect(result).not.toBe("sent_but_bookkeeping_failed");
    expect(calls.length).toBeGreaterThan(0);
    expect((calls[0].payload as { notification_status: string }).notification_status).not.toBe("pending");
    expect((calls[0].payload as { notification_status: string }).notification_status).toBe("disabled");
  });

  test("disabled mode: a bookkeeping failure while writing 'disabled' is logged safely, result is still 'disabled'", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { calls, client } = fakeSupabaseForNotification({ updateError: true });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await sendInquiryNotification(client, null, baseInput);
    expect(result).toBe("disabled");
    expect(calls[0].payload).toEqual({ notification_status: "disabled" });
    const logged = spy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toContain('Failed to record notification status "disabled"');
    spy.mockRestore();
  });

  test("production with a missing EMAIL_SENDING_MODE is a controlled config error: recorded as failed, sender never called", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAIL_SENDING_MODE", undefined);
    const { calls, client } = fakeSupabaseForNotification();
    let sendCalled = false;
    const sender: EmailSender = { emails: { send: async () => { sendCalled = true; return { data: null, error: null }; } } };
    const result = await sendInquiryNotification(client, sender, baseInput);
    expect(result).toBe("send_failed");
    expect(sendCalled).toBe(false);
    expect(calls[0].payload).toEqual({ notification_status: "failed" });
  });

  test("test/CI environment forces disabled even if EMAIL_SENDING_MODE=send", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("EMAIL_SENDING_MODE", "send");
    const { client } = fakeSupabaseForNotification();
    let sendCalled = false;
    const sender: EmailSender = { emails: { send: async () => { sendCalled = true; return { data: null, error: null }; } } };
    const result = await sendInquiryNotification(client, sender, baseInput);
    expect(result).toBe("disabled");
    expect(sendCalled).toBe(false);
  });
});

describe("sendInquiryNotification — send path (mode explicitly allowed)", () => {
  test("null sender: no email attempted, status recorded as failed", async () => {
    allowSendMode();
    const { calls, client } = fakeSupabaseForNotification();
    const result = await sendInquiryNotification(client, null, baseInput);
    expect(result).toBe("send_failed");
    expect(calls[0].payload).toEqual({ notification_status: "failed" });
  });

  test("missing notification config env vars: no email attempted, status recorded as failed", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAIL_SENDING_MODE", "send");
    vi.stubEnv("INQUIRY_NOTIFICATION_TO", undefined);
    const { calls, client } = fakeSupabaseForNotification();
    let sendCalled = false;
    const sender: EmailSender = { emails: { send: async () => { sendCalled = true; return { data: null, error: null }; } } };
    const result = await sendInquiryNotification(client, sender, baseInput);
    expect(result).toBe("send_failed");
    expect(sendCalled).toBe(false);
    expect(calls[0].payload).toEqual({ notification_status: "failed" });
  });

  test("resend returns an error: reported as send_failed, status recorded", async () => {
    allowSendMode();
    const { calls, client } = fakeSupabaseForNotification();
    const sender: EmailSender = { emails: { send: async () => ({ data: null, error: { message: "resend down" } }) } };
    const result = await sendInquiryNotification(client, sender, baseInput);
    expect(result).toBe("send_failed");
    expect(calls[0].payload).toEqual({ notification_status: "failed" });
  });

  test("resend throws: reported as send_failed, status recorded", async () => {
    allowSendMode();
    const { calls, client } = fakeSupabaseForNotification();
    const sender: EmailSender = { emails: { send: async () => { throw new Error("network down"); } } };
    const result = await sendInquiryNotification(client, sender, baseInput);
    expect(result).toBe("send_failed");
    expect(calls[0].payload).toEqual({ notification_status: "failed" });
  });

  test("full success: sent, bookkeeping update recorded", async () => {
    allowSendMode();
    const { calls, client } = fakeSupabaseForNotification();
    let sentArgs: { subject: string } | undefined;
    const sender: EmailSender = {
      emails: {
        send: async (args) => {
          sentArgs = args;
          return { data: { id: "x" }, error: null };
        },
      },
    };
    const result = await sendInquiryNotification(client, sender, baseInput);
    expect(result).toBe("sent");
    expect(calls[0].op).toBe("update");
    expect((calls[0].payload as { notification_status: string }).notification_status).toBe("sent");
    expect(sentArgs?.subject).toBe("New Mintapp project inquiry");
  });

  test("success send but bookkeeping update fails: reported distinctly, not as a send failure", async () => {
    allowSendMode();
    const { client } = fakeSupabaseForNotification({ updateError: true });
    const sender: EmailSender = { emails: { send: async () => ({ data: { id: "x" }, error: null }) } };
    const result = await sendInquiryNotification(client, sender, baseInput);
    expect(result).toBe("sent_but_bookkeeping_failed");
  });
});
