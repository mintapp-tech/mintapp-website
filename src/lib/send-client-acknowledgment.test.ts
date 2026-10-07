import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { sendClientAcknowledgment } from "./send-client-acknowledgment";
import type { EmailSender } from "./send-inquiry-notification";
import { verifyBookingContext } from "./cal-booking-context";

const INQUIRY_ID = "5d2b7a4e-6a43-4f2e-9d3f-0e1d6c9b8a77";
const input = { inquiryId: INQUIRY_ID, name: "Sara Haddad", email: "sara@example.com", lang: "en" as const };

type SendArgs = Parameters<EmailSender["emails"]["send"]>[0];
function recordingSender(result: { error: { message: string; name?: string } | null } = { error: null }) {
  const sent: SendArgs[] = [];
  const sender: EmailSender = {
    emails: {
      send: async (args) => {
        sent.push(args);
        return { data: null, ...result };
      },
    },
  };
  return { sent, sender };
}

function allowSend() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("EMAIL_SENDING_MODE", "send");
  vi.stubEnv("INQUIRY_ACK_FROM", "Mintapp <ack-from@example.com>");
  vi.stubEnv("INQUIRY_ACK_REPLY_TO", "ack-reply@example.com");
  vi.stubEnv("NEXT_PUBLIC_CAL_LINK", "mintapp/mintapp-discovery-call");
  vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", "test-secret-test-secret-test-secret-1234");
}

let errors: ReturnType<typeof vi.spyOn>;
let warnings: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
  warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("sendClientAcknowledgment: sending switch", () => {
  test("disabled by default outside production: nothing is sent", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { sent, sender } = recordingSender();
    expect(await sendClientAcknowledgment(sender, input)).toBe("disabled");
    expect(sent).toHaveLength(0);
    expect(warnings).toHaveBeenCalledWith(expect.stringContaining("client_ack_disabled"));
  });

  test("EMAIL_SENDING_MODE=disabled keeps it off even in production with every address configured (the admin review setting)", async () => {
    allowSend();
    vi.stubEnv("EMAIL_SENDING_MODE", "disabled");
    const { sent, sender } = recordingSender();
    expect(await sendClientAcknowledgment(sender, input)).toBe("disabled");
    expect(sent).toHaveLength(0);
  });

  test("tests and CI can never send, whatever the mode says", async () => {
    allowSend();
    vi.stubEnv("NODE_ENV", "test");
    const { sent, sender } = recordingSender();
    expect(await sendClientAcknowledgment(sender, input)).toBe("disabled");
    expect(sent).toHaveLength(0);
  });

  test("a production deployment with no explicit mode fails safe and sends nothing", async () => {
    allowSend();
    vi.stubEnv("EMAIL_SENDING_MODE", "");
    const { sent, sender } = recordingSender();
    expect(await sendClientAcknowledgment(sender, input)).toBe("send_failed");
    expect(sent).toHaveLength(0);
  });
});

describe("sendClientAcknowledgment: configuration", () => {
  test("no Resend sender: nothing is sent, nothing throws", async () => {
    allowSend();
    expect(await sendClientAcknowledgment(null, input)).toBe("not_configured");
  });

  test.each(["INQUIRY_ACK_FROM", "INQUIRY_ACK_REPLY_TO"])("a missing %s sends nothing and reports not_configured", async (name) => {
    allowSend();
    vi.stubEnv(name, "");
    const { sent, sender } = recordingSender();
    expect(await sendClientAcknowledgment(sender, input)).toBe("not_configured");
    expect(sent).toHaveLength(0);
  });

  test("the sender and reply-to come only from the acknowledgment's own variables, not the internal notification's", async () => {
    allowSend();
    vi.stubEnv("INQUIRY_NOTIFICATION_FROM", "internal-from@example.com");
    vi.stubEnv("INQUIRY_NOTIFICATION_REPLY_TO", "internal-reply@example.com");
    const { sent, sender } = recordingSender();
    await sendClientAcknowledgment(sender, input);
    expect(sent[0].from).toBe("Mintapp <ack-from@example.com>");
    expect(sent[0].replyTo).toBe("ack-reply@example.com");
  });
});

describe("sendClientAcknowledgment: the email", () => {
  test("goes to the client with a fixed subject, HTML and a plain-text alternative", async () => {
    allowSend();
    const { sent, sender } = recordingSender();
    expect(await sendClientAcknowledgment(sender, input)).toBe("sent");
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("sara@example.com");
    expect(sent[0].subject).toBe("We received your project inquiry");
    expect(sent[0].html).toContain("<html lang=\"en\" dir=\"ltr\">");
    expect(sent[0].text.length).toBeGreaterThan(40);
  });

  test("is in the language the client used on the form", async () => {
    allowSend();
    const { sent, sender } = recordingSender();
    await sendClientAcknowledgment(sender, { ...input, lang: "ar", name: "سارة حداد" });
    expect(sent[0].subject).toBe("وصلنا طلب مشروعك");
    expect(sent[0].html).toContain('<html lang="ar" dir="rtl">');
    expect(sent[0].text).toContain("سارة حداد");
  });

  test("the button leads to our own booking page, in the client's language, with a signed reference that verifies to this inquiry", async () => {
    allowSend();
    for (const lang of ["en", "ar"] as const) {
      const { sent, sender } = recordingSender();
      await sendClientAcknowledgment(sender, { ...input, lang });
      const link = new RegExp(`href="(https://www\\.mintapp\\.tech/${lang}/book\\?ref=[^"]+)"`).exec(sent[0].html)?.[1];
      expect(link, lang).toBeDefined();
      const reference = new URL(link!).searchParams.get("ref");
      expect(verifyBookingContext(reference!), lang).toEqual({ ok: true, inquiryId: INQUIRY_ID });
      expect(sent[0].text).toContain(link!);
      expect(sent[0].html).not.toMatch(/href="https:\/\/cal\.com/); // never straight to Cal.com: the page decides
    }
  });

  test("a normal submission gets the normal email: the conditional booking line and the button, not the fallback", async () => {
    allowSend();
    const { sent, sender } = recordingSender();
    await sendClientAcknowledgment(sender, input);
    expect(sent[0].text).toContain("If you haven’t already chosen a time, you can select one below.");
    expect(sent[0].html).toContain(">Choose a call time</a>");
    expect(sent[0].text).not.toContain("We will contact you to arrange");
  });

  test.each([
    ["the signing secret is missing", () => vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", ""), "client_ack_fallback: the booking reference could not be signed"],
    ["no calendar is configured", () => vi.stubEnv("NEXT_PUBLIC_CAL_LINK", ""), "client_ack_fallback: no calendar is configured"],
    ["the calendar link is malformed", () => vi.stubEnv("NEXT_PUBLIC_CAL_LINK", "https://evil.example/x"), "client_ack_fallback: no calendar is configured"],
  ])("the technical fallback, only because %s: the email is still sent, with no button, and says we will contact the client", async (_name, breakIt, logLine) => {
    allowSend();
    breakIt();
    const { sent, sender } = recordingSender();
    expect(await sendClientAcknowledgment(sender, input)).toBe("sent");
    expect(sent[0].html).not.toMatch(/href="https:\/\/(www\.mintapp\.tech\/en\/book|cal\.com)/);
    expect(sent[0].html).not.toContain("Choose a call time");
    expect(sent[0].text).toContain("We will contact you to arrange a time");
    expect(sent[0].text).toContain("Your inquiry has reached the Mintapp team.");
    expect(errors).toHaveBeenCalledWith(logLine); // a fixed line: no inquiry id, no address
  });

  test("the fallback is never chosen for any other reason: not language, not name, not the client's state", async () => {
    allowSend();
    for (const variation of [{ lang: "ar" as const }, { name: "Sara" }, { name: "<b>x</b> http://evil.example" }, { email: "someone.else@example.org" }, { inquiryId: "00000000-0000-4000-8000-000000000001" }]) {
      const { sent, sender } = recordingSender();
      await sendClientAcknowledgment(sender, { ...input, ...variation });
      expect(sent[0].html, JSON.stringify(variation)).toMatch(/href="https:\/\/www\.mintapp\.tech\/(en|ar)\/book\?ref=/);
    }
  });

  test("a hostile name is never echoed into the email", async () => {
    allowSend();
    const { sent, sender } = recordingSender();
    await sendClientAcknowledgment(sender, { ...input, name: "<script>alert(1)</script> http://evil.example" });
    expect(sent[0].html).not.toContain("evil");
    expect(sent[0].text).not.toContain("evil");
  });
});

describe("sendClientAcknowledgment: failure never escapes and never leaks", () => {
  test("a provider error is reported as send_failed and logged without the address, name or provider message", async () => {
    allowSend();
    const { sender } = recordingSender({ error: { name: "validation_error", message: "The `to` address sara@example.com is invalid" } });
    expect(await sendClientAcknowledgment(sender, input)).toBe("send_failed");
    expect(errors).toHaveBeenCalledWith("client_ack_send_failed", "validation_error");
    const logged = JSON.stringify(errors.mock.calls);
    expect(logged).not.toContain("sara@example.com");
    expect(logged).not.toContain("Sara");
  });

  test("a sender that throws is caught", async () => {
    allowSend();
    const sender: EmailSender = { emails: { send: async () => { throw new Error("network down for sara@example.com"); } } };
    await expect(sendClientAcknowledgment(sender, input)).resolves.toBe("send_failed");
    expect(JSON.stringify(errors.mock.calls)).not.toContain("sara@example.com");
  });
});
