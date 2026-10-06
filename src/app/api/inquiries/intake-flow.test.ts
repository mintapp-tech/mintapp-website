import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// The whole intake path, end to end, with only the database and the email
// provider replaced by in-memory fakes: the real route, the real insert, the
// real duplicate lookup, and both real email senders. It proves the guarantees
// that matter when people retry, double-click or open two tabs.

// next/server's after() needs a request context a plain test run does not have:
// capture the scheduled work and run it deterministically.
const afterCallbacks: Array<() => unknown> = [];
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: (cb: () => unknown) => void afterCallbacks.push(cb) };
});

vi.mock("@/lib/verify-turnstile", () => ({ verifyTurnstileToken: async () => ({ ok: true }) }));
vi.mock("@/lib/turnstile-config", () => ({ getTurnstileSecretKey: () => "fake-secret", getAllowedTurnstileHostnames: () => ["www.mintapp.tech"] }));

// ---- the fake database: one table with a unique submission_token, like the real index.
type Row = Record<string, unknown> & { id: string; submission_token: string };
const database = { rows: [] as Row[], updates: [] as { id: string; payload: Record<string, unknown> }[] };
const tick = () => new Promise((resolve) => setTimeout(resolve, 0)); // lets concurrent requests interleave
const fakeClient = {
  from() {
    return {
      select: () => ({
        eq: (_column: string, value: string) => ({
          single: async () => {
            await tick();
            const row = database.rows.find((r) => r.submission_token === value);
            return { data: row ? { id: row.id } : null, error: null };
          },
        }),
      }),
      insert: (payload: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            await tick();
            // Checked and written with no await in between: atomic, like a unique index.
            if (database.rows.some((r) => r.submission_token === payload.submission_token)) return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
            const row = { id: crypto.randomUUID(), ...payload } as Row;
            database.rows.push(row);
            return { data: { id: row.id }, error: null };
          },
        }),
      }),
      update: (payload: Record<string, unknown>) => ({
        eq: async (_column: string, id: string) => {
          database.updates.push({ id, payload });
          return { error: null };
        },
      }),
    };
  },
};
vi.mock("@/lib/supabase-server", () => ({ getSupabaseServerClient: () => fakeClient }));

// ---- the fake email provider: records every send; behaviour can be scripted per recipient.
type Sent = { from: string; to: string; replyTo: string; subject: string; html: string; text: string };
const provider = { sent: [] as Sent[], failFor: new Map<string, "error" | "throw">() };
vi.mock("@/lib/send-inquiry-notification", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/send-inquiry-notification")>();
  return {
    ...actual,
    createRealResendSender: () => ({
      emails: {
        send: async (args: Sent) => {
          const failure = provider.failFor.get(args.to);
          if (failure === "throw") throw new Error(`network failure sending to ${args.to}`);
          if (failure === "error") return { data: null, error: { name: "validation_error", message: `provider rejected ${args.to}: mailbox unavailable` } };
          provider.sent.push(args);
          return { data: { id: "email-id" }, error: null };
        },
      },
    }),
  };
});

const { POST } = await import("./route");

const CLIENT = { name: "Layla Nasser", email: "layla@example.org", phone: "+20 100 555 0199", company: "Nasser Studio", desc: "Private plan: a clinic booking app for Cairo, three branches." };
const INTERNAL_TO = "team@example.com";

const body = (over: Record<string, unknown> = {}) => ({
  ...CLIENT,
  lang: "en",
  projectType: "web_app",
  consent: true,
  submissionToken: crypto.randomUUID(),
  formStartedAt: new Date(Date.now() - 5000).toISOString(),
  turnstileToken: "turnstile-token-" + "x".repeat(20),
  honeypot: "",
  ...over,
});
const post = (payload: unknown) =>
  POST(new Request("http://localhost/api/inquiries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }) as unknown as Parameters<typeof POST>[0]);
async function runScheduledWork() {
  const callbacks = [...afterCallbacks];
  afterCallbacks.length = 0;
  await Promise.all(callbacks.map((cb) => cb()));
}
const toClient = () => provider.sent.filter((e) => e.to === CLIENT.email);
const toTeam = () => provider.sent.filter((e) => e.to === INTERNAL_TO);

let logs: string[];
beforeEach(() => {
  database.rows.length = 0;
  database.updates.length = 0;
  provider.sent.length = 0;
  provider.failFor.clear();
  afterCallbacks.length = 0;
  logs = [];
  for (const method of ["error", "warn", "info", "log"] as const) vi.spyOn(console, method).mockImplementation((...args) => void logs.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")));
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("EMAIL_SENDING_MODE", "send");
  vi.stubEnv("RESEND_API_KEY", "fake-key-not-real");
  vi.stubEnv("INQUIRY_NOTIFICATION_FROM", "Notify <notify@example.com>");
  vi.stubEnv("INQUIRY_NOTIFICATION_TO", INTERNAL_TO);
  vi.stubEnv("INQUIRY_NOTIFICATION_REPLY_TO", "reply@example.com");
  vi.stubEnv("INQUIRY_ACK_FROM", "Mintapp <ack@example.com>");
  vi.stubEnv("INQUIRY_ACK_REPLY_TO", "hello@example.com");
  vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", "test-secret-test-secret-test-secret-1234");
  vi.stubEnv("NEXT_PUBLIC_CAL_LINK", "mintapp/mintapp-discovery-call");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("one inquiry, one acknowledgment", () => {
  test("a new inquiry is saved once and produces exactly one acknowledgment and one internal notification", async () => {
    const res = await post(body());
    expect(res.status).toBe(201);
    await runScheduledWork();
    expect(database.rows).toHaveLength(1);
    expect(toClient()).toHaveLength(1);
    expect(toTeam()).toHaveLength(1);
    expect(provider.sent).toHaveLength(2);
  });

  test("the acknowledgment goes out only after the inquiry is saved, never during the request", async () => {
    await post(body());
    expect(database.rows).toHaveLength(1);
    expect(provider.sent).toHaveLength(0); // the response is already out and nothing has been emailed yet
    await runScheduledWork();
    expect(provider.sent).toHaveLength(2);
  });

  test("a repeated submission token (a retry, a refresh, a double submit) saves nothing new and sends nothing new", async () => {
    const payload = body();
    expect((await post(payload)).status).toBe(201);
    await runScheduledWork();
    for (let attempt = 0; attempt < 3; attempt++) {
      const retry = await post(payload);
      expect(retry.status).toBe(200);
      expect(await retry.json()).toMatchObject({ alreadyReceived: true });
    }
    await runScheduledWork();
    expect(database.rows).toHaveLength(1);
    expect(toClient()).toHaveLength(1);
    expect(toTeam()).toHaveLength(1);
  });

  test("six simultaneous identical requests (two tabs, rapid clicks) create one inquiry and one acknowledgment", async () => {
    const payload = body();
    const responses = await Promise.all(Array.from({ length: 6 }, () => post(payload)));
    const statuses = responses.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 200, 200, 200, 200, 201]); // exactly one was newly saved
    await runScheduledWork();
    expect(database.rows).toHaveLength(1);
    expect(toClient()).toHaveLength(1);
    expect(toTeam()).toHaveLength(1);
    // Every response points at the same inquiry, so every tab books against it.
    const ids = new Set(await Promise.all(responses.map(async (r) => (await r.json()).id)));
    expect(ids).toEqual(new Set([database.rows[0].id]));
  });

  test("different people at the same moment each get their own single acknowledgment", async () => {
    await Promise.all([post(body({ email: "a@example.org" })), post(body({ email: "b@example.org" })), post(body({ email: "c@example.org" }))]);
    await runScheduledWork();
    expect(database.rows).toHaveLength(3);
    for (const address of ["a@example.org", "b@example.org", "c@example.org"]) expect(provider.sent.filter((e) => e.to === address)).toHaveLength(1);
  });

  test("a bot's submission (filled honeypot) is saved nowhere and emails no one", async () => {
    expect((await post(body({ honeypot: "bot" }))).status).toBe(201);
    await runScheduledWork();
    expect(database.rows).toHaveLength(0);
    expect(provider.sent).toHaveLength(0);
  });
});

describe("one email failing never affects the other, the response or the booking", () => {
  test("the internal notification failing (provider error) does not stop the acknowledgment", async () => {
    provider.failFor.set(INTERNAL_TO, "error");
    const res = await post(body());
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ id: database.rows[0].id, bookingContext: expect.any(String) }); // the scheduler still gets its reference
    await runScheduledWork();
    expect(toClient()).toHaveLength(1);
    expect(toTeam()).toHaveLength(0);
    expect(database.updates.at(-1)?.payload).toEqual({ notification_status: "failed" });
  });

  test("the internal notification throwing does not stop the acknowledgment", async () => {
    provider.failFor.set(INTERNAL_TO, "throw");
    expect((await post(body())).status).toBe(201);
    await runScheduledWork();
    expect(toClient()).toHaveLength(1);
  });

  test("the acknowledgment failing (provider error) does not stop the internal notification, the response or the booking reference", async () => {
    provider.failFor.set(CLIENT.email, "error");
    const res = await post(body());
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ bookingContext: expect.any(String) });
    await runScheduledWork();
    expect(toTeam()).toHaveLength(1);
    expect(toClient()).toHaveLength(0);
    expect(database.updates.at(-1)?.payload).toMatchObject({ notification_status: "sent" }); // bookkeeping unaffected
    expect(database.rows).toHaveLength(1);
  });

  test("the acknowledgment throwing does not stop the internal notification", async () => {
    provider.failFor.set(CLIENT.email, "throw");
    expect((await post(body())).status).toBe(201);
    await runScheduledWork();
    expect(toTeam()).toHaveLength(1);
  });

  test("both failing still saves the inquiry and answers success", async () => {
    provider.failFor.set(CLIENT.email, "error");
    provider.failFor.set(INTERNAL_TO, "throw");
    const res = await post(body());
    expect(res.status).toBe(201);
    await expect(runScheduledWork()).resolves.toBeUndefined();
    expect(database.rows).toHaveLength(1);
  });
});

describe("sending can be switched off completely", () => {
  test("EMAIL_SENDING_MODE=disabled sends nothing at all, and the inquiry is still saved and booked", async () => {
    vi.stubEnv("EMAIL_SENDING_MODE", "disabled");
    const res = await post(body());
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ bookingContext: expect.any(String) });
    await runScheduledWork();
    expect(provider.sent).toHaveLength(0);
    expect(database.rows).toHaveLength(1);
    expect(database.updates.at(-1)?.payload).toEqual({ notification_status: "disabled" });
  });

  test("a missing acknowledgment address sends no acknowledgment but never blocks the rest", async () => {
    vi.stubEnv("INQUIRY_ACK_FROM", "");
    expect((await post(body())).status).toBe(201);
    await runScheduledWork();
    expect(toClient()).toHaveLength(0);
    expect(toTeam()).toHaveLength(1);
  });
});

describe("language, escaping and project type", () => {
  test("the acknowledgment follows the form's language; the internal notification stays English", async () => {
    await post(body({ lang: "ar", name: "ليلى ناصر" }));
    await runScheduledWork();
    expect(toClient()[0].subject).toBe("وصلنا طلب مشروعك");
    expect(toClient()[0].html).toContain('<html lang="ar" dir="rtl">');
    expect(toClient()[0].html).toContain("/ar/book?ref=");
    expect(toTeam()[0].subject).toBe("New Mintapp project inquiry");
    expect(toTeam()[0].html).toContain('<html lang="en" dir="ltr">');

    provider.sent.length = 0;
    await post(body({ lang: "en" }));
    await runScheduledWork();
    expect(toClient()[0].subject).toBe("We received your project inquiry");
    expect(toClient()[0].html).toContain("/en/book?ref=");
  });

  test("every client-controlled value is escaped in both emails, and kept as typed in the internal plain text", async () => {
    const hostile = { name: `<script>alert(1)</script> "Q" & Co`, company: `<b onmouseover=x>Co</b>`, phone: "<i>1</i>", desc: `<img src=x onerror=alert(1)> and a long enough description` };
    await post(body(hostile));
    await runScheduledWork();
    for (const email of provider.sent) {
      expect(email.html).not.toMatch(/<script>|<img src=x|<b onmouseover|<i>1/);
      expect(email.html).not.toMatch(/<[^>]*\son[a-z]+=/i); // no real tag carries an event handler (the words inside escaped text are harmless)
    }
    expect(toTeam()[0].html).toContain("&lt;script&gt;");
    expect(toTeam()[0].text).toContain(`Name: ${hostile.name}`);
    expect(toClient()[0].text).toMatch(/^Hello,/); // not a plain name: never echoed to a possibly different recipient
  });

  test("the internal notification carries the client's project type, and says Not provided for an older form", async () => {
    await post(body({ projectType: "mobile_app" }));
    await runScheduledWork();
    expect(toTeam()[0].text).toContain("Project type: Mobile application");
    provider.sent.length = 0;
    const withoutType = body();
    delete (withoutType as Record<string, unknown>).projectType;
    await post(withoutType);
    await runScheduledWork();
    expect(toTeam()[0].text).toContain("Project type: Not provided");
    expect(database.rows.at(-1)).not.toHaveProperty("project_type"); // nothing guessed
  });
});

describe("logs never contain what a client wrote", () => {
  test("across success, retries, a race, provider errors, thrown errors and a disabled mode: no name, address, phone, company, brief, token or provider message", async () => {
    // Success and retries.
    const payload = body();
    await post(payload);
    await post(payload);
    // A race.
    await Promise.all(Array.from({ length: 4 }, () => post(body({ email: "race@example.org" }))));
    await runScheduledWork();
    // Provider errors that quote the address, and a thrown error that does too.
    provider.failFor.set(CLIENT.email, "error");
    provider.failFor.set(INTERNAL_TO, "throw");
    await post(body());
    await runScheduledWork();
    // Sending off.
    vi.stubEnv("EMAIL_SENDING_MODE", "disabled");
    await post(body());
    await runScheduledWork();

    const everything = logs.join("\n").toLowerCase();
    expect(logs.length).toBeGreaterThan(0); // the failures were logged...
    for (const secret of ["layla", "nasser", "layla@example.org", "race@example.org", "+20 100", "clinic booking", "mailbox unavailable", "network failure", "turnstile-token", payload.submissionToken]) {
      expect(everything, secret).not.toContain(secret.toLowerCase()); // ...without saying who or what
    }
  });
});
