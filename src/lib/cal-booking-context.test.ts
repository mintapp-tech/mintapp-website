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

  test("context older than 30 days is rejected", () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", SECRET);
    const thirtyOneDaysAgo = Math.floor(Date.now() / 1000) - 31 * 24 * 60 * 60;
    const payloadB64 = validPayloadB64({ iat: thirtyOneDaysAgo });
    expect(verifyBookingContext(`${payloadB64}.${signPayload(payloadB64, SECRET)}`)).toEqual({ ok: false });
  });

  test("context within 30 days is accepted, including ages that the old 7-day limit refused", () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", SECRET);
    for (const days of [1, 8, 29]) {
      const issued = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
      const payloadB64 = validPayloadB64({ iat: issued });
      expect(verifyBookingContext(`${payloadB64}.${signPayload(payloadB64, SECRET)}`), `${days} days`).toEqual({ ok: true, inquiryId: VALID_UUID });
    }
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

describe("what the reference is (verified before the lifetime was extended)", () => {
  test("it carries only an opaque inquiry id and an issue time: no name, email, phone or brief", () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", SECRET);
    const [payloadB64] = signBookingContext(VALID_UUID).split(".");
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    expect(Object.keys(payload).sort()).toEqual(["iat", "id"]);
    expect(payload.id).toBe(VALID_UUID);
    expect(Number.isInteger(payload.iat)).toBe(true);
    expect(JSON.stringify(payload)).not.toMatch(/@|name|phone|email|desc/i);
  });

  test("it is short and URL-safe, so it fits in a link and in the browser without exposing anything", () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", SECRET);
    const token = signBookingContext(VALID_UUID);
    expect(token.length).toBeLessThan(160);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  test("it cannot be guessed: two references for the same inquiry differ only by issue time, and a signature needs the secret", () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", SECRET);
    const [payloadB64] = signBookingContext(VALID_UUID).split(".");
    // Right id and a fresh time, but a signature made without the secret.
    const forged = validPayloadB64({ iat: Math.floor(Date.now() / 1000) });
    expect(verifyBookingContext(`${forged}.${signPayload(forged, "not-the-secret")}`)).toEqual({ ok: false });
    expect(verifyBookingContext(`${payloadB64}.${"A".repeat(43)}`)).toEqual({ ok: false });
  });

  test("it is only an association: verifying it returns the inquiry id and nothing else", () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", SECRET);
    expect(Object.keys(verifyBookingContext(signBookingContext(VALID_UUID))).sort()).toEqual(["inquiryId", "ok"]);
  });
});

// Deterministic: a fixed clock and a fixed secret, so every reference below is
// the same on every run and every assertion is exhaustive rather than sampled.
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const NOW = new Date("2026-10-06T12:00:00.000Z");

function fixedToken(): { token: string; payloadB64: string; signature: string } {
  vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", SECRET);
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  const token = signBookingContext(VALID_UUID);
  const [payloadB64, signature] = token.split(".");
  return { token, payloadB64, signature };
}

describe("verifyBookingContext — strict canonical signature (fixed clock, exhaustive)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("the canonical reference verifies, and its signature is exactly 43 unpadded base64url characters", () => {
    const { token, signature } = fixedToken();
    expect(signature).toHaveLength(43);
    expect(signature).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(verifyBookingContext(token)).toEqual({ ok: true, inquiryId: VALID_UUID });
  });

  test("every non-canonical spelling of the final signature character is rejected, though it decodes to the same bytes", () => {
    const { payloadB64, signature } = fixedToken();
    const canonicalBytes = Buffer.from(signature, "base64url");
    const alternatives = [...ALPHABET]
      .map((ch) => signature.slice(0, -1) + ch)
      .filter((candidate) => candidate !== signature && Buffer.from(candidate, "base64url").equals(canonicalBytes));
    // 258 bits carry a 256-bit digest: the two spare bits give exactly three other spellings.
    expect(alternatives).toHaveLength(3);
    for (const alternative of alternatives) {
      expect(verifyBookingContext(`${payloadB64}.${alternative}`), alternative).toEqual({ ok: false });
    }
  });

  test("changing any signature character to any other character is rejected, at every position (43 x 63 variants)", () => {
    const { payloadB64, signature } = fixedToken();
    let variants = 0;
    for (let i = 0; i < signature.length; i++) {
      for (const ch of ALPHABET) {
        if (ch === signature[i]) continue;
        variants++;
        const changed = signature.slice(0, i) + ch + signature.slice(i + 1);
        expect(verifyBookingContext(`${payloadB64}.${changed}`), `position ${i} -> ${ch}`).toEqual({ ok: false });
      }
    }
    expect(variants).toBe(43 * 63);
  });

  test("changing any payload character to any other character is rejected, at every position", () => {
    const { payloadB64, signature } = fixedToken();
    for (let i = 0; i < payloadB64.length; i++) {
      for (const ch of ALPHABET) {
        if (ch === payloadB64[i]) continue;
        const changed = payloadB64.slice(0, i) + ch + payloadB64.slice(i + 1);
        expect(verifyBookingContext(`${changed}.${signature}`), `payload position ${i} -> ${ch}`).toEqual({ ok: false });
      }
    }
  });

  test("a signature of the wrong length is rejected: every length from 0 to 60 except 43", () => {
    const { payloadB64, signature } = fixedToken();
    const padded = signature + "A".repeat(20);
    for (let length = 0; length <= 60; length++) {
      if (length === 43) continue;
      expect(verifyBookingContext(`${payloadB64}.${padded.slice(0, length)}`), `length ${length}`).toEqual({ ok: false });
    }
  });

  test("padding in the signature is rejected, whether it replaces the end or is appended", () => {
    const { payloadB64, signature } = fixedToken();
    expect(verifyBookingContext(`${payloadB64}.${signature}=`)).toEqual({ ok: false });
    expect(verifyBookingContext(`${payloadB64}.${signature}==`)).toEqual({ ok: false });
    expect(verifyBookingContext(`${payloadB64}.${signature.slice(0, 42)}=`)).toEqual({ ok: false });
  });

  test("characters outside the base64url alphabet in the signature are rejected, including standard base64 '+' and '/'", () => {
    const { payloadB64, signature } = fixedToken();
    for (const bad of ["+", "/", " ", "\n", "%", "*", "é", "\u0000"]) {
      expect(verifyBookingContext(`${payloadB64}.${signature.slice(0, 42)}${bad}`), JSON.stringify(bad)).toEqual({ ok: false });
      expect(verifyBookingContext(`${payloadB64}.${bad}${signature.slice(1)}`), JSON.stringify(bad)).toEqual({ ok: false });
    }
  });

  test("a validly signed payload that was altered is rejected, and one re-signed with the wrong secret is too", () => {
    const { payloadB64, signature } = fixedToken();
    const otherId = Buffer.from(JSON.stringify({ id: "00000000-0000-4000-8000-000000000000", iat: Math.floor(NOW.getTime() / 1000) }), "utf8").toString("base64url");
    expect(verifyBookingContext(`${otherId}.${signature}`)).toEqual({ ok: false });
    expect(verifyBookingContext(`${otherId}.${signPayload(otherId, "not-the-secret")}`)).toEqual({ ok: false });
    // Control: the same altered payload signed with the real secret is a legitimate reference.
    expect(verifyBookingContext(`${otherId}.${signPayload(otherId, SECRET)}`)).toEqual({ ok: true, inquiryId: "00000000-0000-4000-8000-000000000000" });
    expect(payloadB64).not.toBe(otherId);
  });

  test("references 29 days old verify; references 31 days old do not; the 30-day edge is exact", () => {
    vi.stubEnv("CAL_BOOKING_CONTEXT_SECRET", SECRET);
    vi.useFakeTimers();
    const issuedAt = Math.floor(NOW.getTime() / 1000);
    const payload = Buffer.from(JSON.stringify({ id: VALID_UUID, iat: issuedAt }), "utf8").toString("base64url");
    const token = `${payload}.${signPayload(payload, SECRET)}`;
    const day = 24 * 60 * 60 * 1000;
    const at = (ms: number) => vi.setSystemTime(new Date(NOW.getTime() + ms));
    at(29 * day);
    expect(verifyBookingContext(token)).toEqual({ ok: true, inquiryId: VALID_UUID });
    at(30 * day);
    expect(verifyBookingContext(token)).toEqual({ ok: true, inquiryId: VALID_UUID });
    at(30 * day + 1000);
    expect(verifyBookingContext(token)).toEqual({ ok: false });
    at(31 * day);
    expect(verifyBookingContext(token)).toEqual({ ok: false });
  });

  test("every rejection is the identical { ok: false }, so a caller cannot tell which check failed", () => {
    const { payloadB64, signature } = fixedToken();
    const rejected = [
      "",
      ".",
      "a.b",
      `${payloadB64}.${signature.slice(0, -1)}`,
      `${payloadB64}.${signature}=`,
      `${payloadB64}.${signature.slice(0, -1)}${signature.at(-1) === "A" ? "B" : "A"}`,
      `${payloadB64}x.${signature}`,
    ].map((candidate) => verifyBookingContext(candidate));
    for (const result of rejected) expect(result).toStrictEqual({ ok: false });
  });
});
