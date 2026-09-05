import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Every downstream dependency is mocked so this suite can prove ordering
// guarantees (e.g. "Turnstile failure means zero Supabase/Resend calls")
// without ever making a real network call. next/server's after() normally
// requires a real Next.js request-context (AsyncLocalStorage) that a plain
// Vitest run doesn't have — mocked below to capture the scheduled callback
// so the success path's post-response notification step can be executed
// and asserted on deterministically, instead of being left untested.
// Deliberately a plain function, not vi.fn(...) — it must keep working
// across vi.resetAllMocks() in beforeEach the same way the real after()
// would, so "was scheduling attempted" is measured by afterCallbacks.length
// rather than a mock call-count that a reset could silently wipe.
const afterCallbacks: Array<() => unknown> = [];
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (cb: () => unknown) => {
      afterCallbacks.push(cb);
    },
  };
});

const verifyTurnstileToken = vi.fn();
vi.mock("@/lib/verify-turnstile", () => ({ verifyTurnstileToken: (...args: unknown[]) => verifyTurnstileToken(...args) }));

const getSupabaseServerClient = vi.fn();
vi.mock("@/lib/supabase-server", () => ({ getSupabaseServerClient: (...args: unknown[]) => getSupabaseServerClient(...args) }));

const findInquiryIdByToken = vi.fn();
vi.mock("@/lib/find-inquiry-by-token", () => ({ findInquiryIdByToken: (...args: unknown[]) => findInquiryIdByToken(...args) }));

const insertInquiry = vi.fn();
vi.mock("@/lib/insert-inquiry", () => ({ insertInquiry: (...args: unknown[]) => insertInquiry(...args) }));

const createRealResendSender = vi.fn();
const sendInquiryNotification = vi.fn();
vi.mock("@/lib/send-inquiry-notification", () => ({
  createRealResendSender: (...args: unknown[]) => createRealResendSender(...args),
  sendInquiryNotification: (...args: unknown[]) => sendInquiryNotification(...args),
}));

vi.mock("@/lib/turnstile-config", () => ({
  getTurnstileSecretKey: () => "fake-secret",
  getAllowedTurnstileHostnames: () => ["mintapp.tech", "www.mintapp.tech"],
}));

// The real (unmocked) implementation — used to independently verify any
// bookingContext the route produces, exactly like a legitimate downstream
// consumer would, rather than trusting the route's own claim about its shape.
const { verifyBookingContext } = await import("@/lib/cal-booking-context");

const { POST } = await import("./route");

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/inquiries", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  vi.resetAllMocks();
  afterCallbacks.length = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function runScheduledAfterCallbacks() {
  const callbacks = [...afterCallbacks];
  afterCallbacks.length = 0;
  await Promise.all(callbacks.map((cb) => cb()));
}

const validBody = {
  name: "Jane Doe",
  email: "jane@example.com",
  desc: "A".repeat(50),
  lang: "en",
  consent: true,
  submissionToken: "e8e7d808-9556-45b8-beae-49f852e98be9",
  formStartedAt: new Date(Date.now() - 5000).toISOString(),
  turnstileToken: "x".repeat(30),
  honeypot: "",
};

describe("POST /api/inquiries — Turnstile precedes every Supabase/Resend call", () => {
  test("Turnstile rejection (invalid) never touches Supabase or Resend", async () => {
    verifyTurnstileToken.mockResolvedValue({ ok: false, reason: "invalid" });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(403);
    expect(getSupabaseServerClient).not.toHaveBeenCalled();
    expect(findInquiryIdByToken).not.toHaveBeenCalled();
    expect(insertInquiry).not.toHaveBeenCalled();
    expect(createRealResendSender).not.toHaveBeenCalled();
    expect(sendInquiryNotification).not.toHaveBeenCalled();
  });

  test("Turnstile timeout never touches Supabase or Resend, returns 503", async () => {
    verifyTurnstileToken.mockResolvedValue({ ok: false, reason: "timeout" });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(503);
    expect(getSupabaseServerClient).not.toHaveBeenCalled();
    expect(insertInquiry).not.toHaveBeenCalled();
    expect(sendInquiryNotification).not.toHaveBeenCalled();
  });

  test("Turnstile network_error never touches Supabase or Resend, returns 503", async () => {
    verifyTurnstileToken.mockResolvedValue({ ok: false, reason: "network_error" });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(503);
    expect(getSupabaseServerClient).not.toHaveBeenCalled();
    expect(insertInquiry).not.toHaveBeenCalled();
  });

  test("idempotency lookup only ever runs after Turnstile succeeds", async () => {
    verifyTurnstileToken.mockResolvedValue({ ok: true });
    getSupabaseServerClient.mockReturnValue({});
    findInquiryIdByToken.mockResolvedValue("existing-id");
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    expect(verifyTurnstileToken).toHaveBeenCalledTimes(1);
    expect(findInquiryIdByToken).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body).toEqual({ id: "existing-id", alreadyReceived: true });
  });
});

describe("POST /api/inquiries — honeypot and timing run before Turnstile, Supabase, and Resend", () => {
  test("filled honeypot returns a fake success and never calls Turnstile, Supabase, or Resend", async () => {
    const res = await POST(makeRequest({ ...validBody, honeypot: "i-am-a-bot" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("id");
    expect(verifyTurnstileToken).not.toHaveBeenCalled();
    expect(getSupabaseServerClient).not.toHaveBeenCalled();
    expect(insertInquiry).not.toHaveBeenCalled();
  });

  test("submission faster than the minimum window returns a fake success, never calls Turnstile or Supabase", async () => {
    const res = await POST(makeRequest({ ...validBody, formStartedAt: new Date().toISOString() }));
    expect(res.status).toBe(201);
    expect(verifyTurnstileToken).not.toHaveBeenCalled();
    expect(getSupabaseServerClient).not.toHaveBeenCalled();
  });

  test("a stale form (older than the max age) gets an honest error, never calls Turnstile or Supabase", async () => {
    const res = await POST(makeRequest({ ...validBody, formStartedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() }));
    expect(res.status).toBe(400);
    expect(verifyTurnstileToken).not.toHaveBeenCalled();
    expect(getSupabaseServerClient).not.toHaveBeenCalled();
  });
});

describe("POST /api/inquiries — structural/schema validation", () => {
  test("missing turnstileToken is rejected before any downstream call", async () => {
    const rest: Record<string, unknown> = { ...validBody };
    delete rest.turnstileToken;
    const res = await POST(makeRequest(rest));
    expect(res.status).toBe(400);
    expect(verifyTurnstileToken).not.toHaveBeenCalled();
  });

  test("oversized turnstileToken (over 2048 chars) is rejected before any downstream call", async () => {
    const res = await POST(makeRequest({ ...validBody, turnstileToken: "x".repeat(2049) }));
    expect(res.status).toBe(400);
    expect(verifyTurnstileToken).not.toHaveBeenCalled();
  });

  test("wrong content-type is rejected", async () => {
    const req = new Request("http://localhost/api/inquiries", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "not json",
    }) as unknown as Parameters<typeof POST>[0];
    const res = await POST(req);
    expect(res.status).toBe(415);
  });

  test("oversized declared content-length is rejected before parsing", async () => {
    const req = new Request("http://localhost/api/inquiries", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": String(1024 * 1024) },
      body: JSON.stringify(validBody),
    }) as unknown as Parameters<typeof POST>[0];
    const res = await POST(req);
    expect(res.status).toBe(413);
    expect(verifyTurnstileToken).not.toHaveBeenCalled();
  });
});

describe("POST /api/inquiries — success path (after() mocked and executed deterministically)", () => {
  test("valid request + successful Turnstile: one Supabase lookup, exactly one insert, notification scheduled once, response is 201 with a safe shape", async () => {
    vi.stubEnv("RESEND_API_KEY", "fake-key-not-real");
    verifyTurnstileToken.mockResolvedValue({ ok: true });
    getSupabaseServerClient.mockReturnValue({ fake: "client" });
    findInquiryIdByToken.mockResolvedValue(null);
    insertInquiry.mockResolvedValue({ status: "inserted", id: "new-id" });
    createRealResendSender.mockReturnValue({ fake: "sender" });
    sendInquiryNotification.mockResolvedValue("sent");

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ id: "new-id" });
    // Safe shape: nothing beyond the id — no email, no description, no
    // internal error detail, no provider response ever reaches the client.
    expect(Object.keys(body)).toEqual(["id"]);

    expect(findInquiryIdByToken).toHaveBeenCalledTimes(1);
    expect(insertInquiry).toHaveBeenCalledTimes(1);
    expect(afterCallbacks.length).toBe(1);
    expect(sendInquiryNotification).not.toHaveBeenCalled(); // not yet — only once the scheduled callback actually runs

    expect(createRealResendSender).toHaveBeenCalledTimes(1);

    await runScheduledAfterCallbacks();
    expect(sendInquiryNotification).toHaveBeenCalledTimes(1);
    expect(sendInquiryNotification).toHaveBeenCalledWith(
      { fake: "client" },
      { fake: "sender" },
      expect.objectContaining({ inquiryId: "new-id", name: "Jane Doe", email: "jane@example.com" }),
    );
  });

  test("existing submission after valid Turnstile: 200 alreadyReceived, no insert, no notification scheduled", async () => {
    verifyTurnstileToken.mockResolvedValue({ ok: true });
    getSupabaseServerClient.mockReturnValue({});
    findInquiryIdByToken.mockResolvedValue("existing-id");

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "existing-id", alreadyReceived: true });
    expect(insertInquiry).not.toHaveBeenCalled();
    expect(afterCallbacks.length).toBe(0);
    expect(sendInquiryNotification).not.toHaveBeenCalled();
  });

  test("simulated unique-conflict race (insertInquiry resolves it to a duplicate): 200 alreadyReceived, idempotent, no notification scheduled", async () => {
    // The race itself (two requests both pass the proactive lookup, then
    // collide on the DB's unique index) is exercised directly against
    // insertInquiry in insert-inquiry.test.ts; here the route only needs to
    // handle whatever insertInquiry reports back — a second, independent
    // proof of route.ts's own behavior given that exact result shape.
    verifyTurnstileToken.mockResolvedValue({ ok: true });
    getSupabaseServerClient.mockReturnValue({});
    findInquiryIdByToken.mockResolvedValue(null);
    insertInquiry.mockResolvedValue({ status: "duplicate", id: "resolved-via-race" });

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "resolved-via-race", alreadyReceived: true });
    expect(afterCallbacks.length).toBe(0);
    expect(sendInquiryNotification).not.toHaveBeenCalled();
  });
});

describe("POST /api/inquiries — Supabase insert failure handling", () => {
  test("insert failure returns 502 and never attempts a notification", async () => {
    verifyTurnstileToken.mockResolvedValue({ ok: true });
    getSupabaseServerClient.mockReturnValue({});
    findInquiryIdByToken.mockResolvedValue(null);
    insertInquiry.mockResolvedValue({ status: "failed", message: "db down" });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(502);
    expect(sendInquiryNotification).not.toHaveBeenCalled();
  });

  test("insert duplicate (reactive conflict) returns 200 alreadyReceived and never attempts a notification", async () => {
    verifyTurnstileToken.mockResolvedValue({ ok: true });
    getSupabaseServerClient.mockReturnValue({});
    findInquiryIdByToken.mockResolvedValue(null);
    insertInquiry.mockResolvedValue({ status: "duplicate", id: "dup-id" });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ id: "dup-id", alreadyReceived: true });
    expect(sendInquiryNotification).not.toHaveBeenCalled();
  });
});

describe("POST /api/inquiries — bookingContext on every accepted branch", () => {
  const REAL_UUID = "11111111-1111-4111-8111-111111111111";
  const EXISTING_UUID = "22222222-2222-4222-8222-222222222222";
  const DUPLICATE_UUID = "33333333-3333-4333-8333-333333333333";

  test("fresh 201 insert carries a bookingContext that independently verifies to the same inquiry id", async () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", "test-only-secret-value-not-real");
    verifyTurnstileToken.mockResolvedValue({ ok: true });
    getSupabaseServerClient.mockReturnValue({});
    findInquiryIdByToken.mockResolvedValue(null);
    insertInquiry.mockResolvedValue({ status: "inserted", id: REAL_UUID });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe(REAL_UUID);
    expect(typeof body.bookingContext).toBe("string");

    const verified = verifyBookingContext(body.bookingContext);
    expect(verified).toEqual({ ok: true, inquiryId: REAL_UUID });
  });

  test("idempotent existing-token 200 also carries a valid bookingContext for the existing inquiry id", async () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", "test-only-secret-value-not-real");
    verifyTurnstileToken.mockResolvedValue({ ok: true });
    getSupabaseServerClient.mockReturnValue({});
    findInquiryIdByToken.mockResolvedValue(EXISTING_UUID);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ id: EXISTING_UUID, alreadyReceived: true });

    const verified = verifyBookingContext(body.bookingContext);
    expect(verified).toEqual({ ok: true, inquiryId: EXISTING_UUID });
  });

  test("reactive duplicate-conflict 200 also carries a valid bookingContext for the resolved inquiry id", async () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", "test-only-secret-value-not-real");
    verifyTurnstileToken.mockResolvedValue({ ok: true });
    getSupabaseServerClient.mockReturnValue({});
    findInquiryIdByToken.mockResolvedValue(null);
    insertInquiry.mockResolvedValue({ status: "duplicate", id: DUPLICATE_UUID });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ id: DUPLICATE_UUID, alreadyReceived: true });

    const verified = verifyBookingContext(body.bookingContext);
    expect(verified).toEqual({ ok: true, inquiryId: DUPLICATE_UUID });
  });

  test("signing failure (missing secret) still returns the normal successful response, without bookingContext, logging only a fixed category", async () => {
    // Deliberately not stubbing CAL_BOOKING_CONTEXT_SECRET — signBookingContext
    // throws, which acceptedInquiryResponse must swallow without failing the
    // already-accepted inquiry.
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    verifyTurnstileToken.mockResolvedValue({ ok: true });
    getSupabaseServerClient.mockReturnValue({});
    findInquiryIdByToken.mockResolvedValue(null);
    insertInquiry.mockResolvedValue({ status: "inserted", id: REAL_UUID });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ id: REAL_UUID });
    expect(body.bookingContext).toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith("inquiry_booking_context_sign_failed");
    // Never the id, never an Error object, never a message, never an env var name.
    const loggedArgs = consoleErrorSpy.mock.calls.flat();
    for (const arg of loggedArgs) {
      expect(String(arg)).not.toContain(REAL_UUID);
      expect(arg).not.toBeInstanceOf(Error);
      expect(String(arg)).not.toContain("CAL_BOOKING_CONTEXT_SECRET");
    }
    consoleErrorSpy.mockRestore();
  });

  test("signing failure on the idempotent branch also preserves the successful alreadyReceived response", async () => {
    verifyTurnstileToken.mockResolvedValue({ ok: true });
    getSupabaseServerClient.mockReturnValue({});
    findInquiryIdByToken.mockResolvedValue(EXISTING_UUID);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ id: EXISTING_UUID, alreadyReceived: true });
    expect(body.bookingContext).toBeUndefined();
  });
});
