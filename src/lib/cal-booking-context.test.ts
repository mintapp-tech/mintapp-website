import { afterEach, describe, expect, test, vi } from "vitest";
import { createHmac } from "node:crypto";
import { signBookingContext, verifyBookingContext } from "./cal-booking-context";

function signPayload(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

const SECRET = "test-cal-booking-context-secret-not-real";
const VALID_UUID = "e8e7d808-9556-45b8-beae-49f852e98be9";

function validPayloadB64(overrides: Record<string, unknown> = {}) {
  return Buffer.from(JSON.stringify({ id: VALID_UUID, iat: Math.floor(Date.now() / 1000), ...overrides }), "utf8").toString("base64url");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("signBookingContext — validates before signing", () => {
  test("throws for a malformed (non-UUID) inquiry id rather than signing it", () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", SECRET);
    expect(() => signBookingContext("not-a-uuid")).toThrow();
  });

  test("valid uuid signs successfully and round-trips", () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", SECRET);
    const token = signBookingContext(VALID_UUID);
    expect(verifyBookingContext(token)).toEqual({ ok: true, inquiryId: VALID_UUID });
  });
});

describe("verifyBookingContext — missing secret is a thrown config fault, not {ok:false}", () => {
  test("a well-formed token, with the secret then removed, THROWS rather than returning {ok:false}", () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", SECRET);
    const token = signBookingContext(VALID_UUID);
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", undefined);
    expect(() => verifyBookingContext(token)).toThrow();
  });
});

describe("signBookingContext / verifyBookingContext — core round-trip and tampering", () => {
  test("round-trips: signed context verifies back to the same inquiry id", () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", SECRET);
    const token = signBookingContext(VALID_UUID);
    expect(verifyBookingContext(token)).toEqual({ ok: true, inquiryId: VALID_UUID });
  });

  test("tampered signature is rejected", () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", SECRET);
    const token = signBookingContext(VALID_UUID);
    const [payload] = token.split(".");
    const tampered = `${payload}.${"A".repeat(43)}`;
    expect(verifyBookingContext(tampered)).toEqual({ ok: false });
  });

  test("tampered payload (different inquiry id, same original signature) is rejected", () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", SECRET);
    const token = signBookingContext(VALID_UUID);
    const [, signature] = token.split(".");
    const forgedPayload = validPayloadB64({ id: "11111111-1111-1111-1111-111111111111" });
    expect(verifyBookingContext(`${forgedPayload}.${signature}`)).toEqual({ ok: false });
  });

  test("signed with a different secret than the one used to verify is rejected", () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", SECRET);
    const token = signBookingContext(VALID_UUID);
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", "a-completely-different-secret");
    expect(verifyBookingContext(token)).toEqual({ ok: false });
  });

  test("payload with a non-UUID id is rejected", () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", SECRET);
    const payloadB64 = validPayloadB64({ id: "not-a-uuid" });
    expect(verifyBookingContext(`${payloadB64}.${signPayload(payloadB64, SECRET)}`)).toEqual({ ok: false });
  });

  test("context older than 7 days is rejected", () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", SECRET);
    const eightDaysAgo = Math.floor(Date.now() / 1000) - 8 * 24 * 60 * 60;
    const payloadB64 = validPayloadB64({ iat: eightDaysAgo });
    expect(verifyBookingContext(`${payloadB64}.${signPayload(payloadB64, SECRET)}`)).toEqual({ ok: false });
  });

  test("context exactly within 7 days is accepted", () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", SECRET);
    const sixDaysAgo = Math.floor(Date.now() / 1000) - 6 * 24 * 60 * 60;
    const payloadB64 = validPayloadB64({ iat: sixDaysAgo });
    expect(verifyBookingContext(`${payloadB64}.${signPayload(payloadB64, SECRET)}`)).toEqual({ ok: true, inquiryId: VALID_UUID });
  });

  test("context issued too far in the future (beyond 5 minute clock skew) is rejected", () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", SECRET);
    const tenMinutesFuture = Math.floor(Date.now() / 1000) + 10 * 60;
    const payloadB64 = validPayloadB64({ iat: tenMinutesFuture });
    expect(verifyBookingContext(`${payloadB64}.${signPayload(payloadB64, SECRET)}`)).toEqual({ ok: false });
  });

  test("context issued slightly in the future (within 5 minute clock skew) is accepted", () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", SECRET);
    const twoMinutesFuture = Math.floor(Date.now() / 1000) + 2 * 60;
    const payloadB64 = validPayloadB64({ iat: twoMinutesFuture });
    expect(verifyBookingContext(`${payloadB64}.${signPayload(payloadB64, SECRET)}`)).toEqual({ ok: true, inquiryId: VALID_UUID });
  });
});

describe("verifyBookingContext — strict payload schema (extra fields rejected)", () => {
  test("an extra field in the payload JSON is rejected, not silently stripped", () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", SECRET);
    const payloadB64 = validPayloadB64({ extra: "field" });
    expect(verifyBookingContext(`${payloadB64}.${signPayload(payloadB64, SECRET)}`)).toEqual({ ok: false });
  });
});

describe("verifyBookingContext — canonical token structure", () => {
  test("valid token is unchanged / accepted (control case)", () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", SECRET);
    const token = signBookingContext(VALID_UUID);
    expect(verifyBookingContext(token)).toEqual({ ok: true, inquiryId: VALID_UUID });
  });

  test("zero dots is rejected", () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", SECRET);
    expect(verifyBookingContext("not-a-real-token")).toEqual({ ok: false });
  });

  test("more than one dot (extra dot) is rejected", () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", SECRET);
    const token = signBookingContext(VALID_UUID);
    expect(verifyBookingContext(`${token}.extra`)).toEqual({ ok: false });
  });

  test("base64url padding ('=') in the payload component is rejected", () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", SECRET);
    const token = signBookingContext(VALID_UUID);
    const [payload, signature] = token.split(".");
    expect(verifyBookingContext(`${payload}=.${signature}`)).toEqual({ ok: false });
  });

  test("whitespace anywhere in the token is rejected", () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", SECRET);
    const token = signBookingContext(VALID_UUID);
    expect(verifyBookingContext(token.replace(".", " ."))).toEqual({ ok: false });
  });

  test("invalid characters (non-base64url) in either component are rejected", () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", SECRET);
    expect(verifyBookingContext("!!!not-base64!!!.alsonotbase64+/=")).toEqual({ ok: false });
  });

  test("garbage appended to an otherwise-valid signature component is rejected (wrong length)", () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", SECRET);
    const token = signBookingContext(VALID_UUID);
    const [payload, signature] = token.split(".");
    expect(verifyBookingContext(`${payload}.${signature}XXXX`)).toEqual({ ok: false });
  });

  test("signature component shorter than 43 chars is rejected outright", () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", SECRET);
    const token = signBookingContext(VALID_UUID);
    const [payload, signature] = token.split(".");
    expect(verifyBookingContext(`${payload}.${signature.slice(0, 40)}`)).toEqual({ ok: false });
  });

  test("oversized payload component (over the 200-char bound) is rejected before decoding", () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", SECRET);
    const hugePayload = "A".repeat(500);
    const sig = signPayload(hugePayload, SECRET);
    expect(verifyBookingContext(`${hugePayload}.${sig}`)).toEqual({ ok: false });
  });

  test("non-canonical base64url (decodes to the same bytes as canonical, wrong trailing-bit representation) is rejected", () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", SECRET);
    // Base64url groups with length%4 == 2 or 3 have "wasted" trailing bits
    // a canonical encoder always sets to zero. A non-canonical string can
    // set those bits to something else and still decode to the identical
    // bytes — found here by brute-force substitution of the final
    // character (verified empirically: this payload shape reliably has
    // length%4==3, i.e. 2 wasted bits, so a substitute exists).
    const canonicalPayloadB64 = validPayloadB64();
    const decodedBytes = Buffer.from(canonicalPayloadB64, "base64url");
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let nonCanonical: string | null = null;
    for (const ch of alphabet) {
      const candidate = canonicalPayloadB64.slice(0, -1) + ch;
      if (candidate === canonicalPayloadB64) continue;
      if (Buffer.from(candidate, "base64url").equals(decodedBytes)) {
        nonCanonical = candidate;
        break;
      }
    }
    expect(nonCanonical).not.toBeNull();
    if (!nonCanonical) return;
    expect(verifyBookingContext(`${nonCanonical}.${signPayload(nonCanonical, SECRET)}`)).toEqual({ ok: false });
  });
});
