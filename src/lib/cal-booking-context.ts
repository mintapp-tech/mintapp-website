import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

// A visitor's browser controls whatever the Cal.com embed sends as
// metadata, so the inquiry id it carries must never be trusted bare — this
// is a compact, signed, opaque token binding a specific inquiry id, valid
// only for a bounded window. Not a general-purpose JWT: hand-rolled and
// deliberately narrow (two fields, one algorithm) rather than pulling in a
// JWT library for something this small.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000; // 5 minutes

// Canonical token shape: exactly one dot, unpadded base64url on both
// sides. HMAC-SHA256 always encodes to exactly 43 base64url characters
// (32 bytes, no padding) — a fixed length, not just a charset, so a
// signature component of any other length is rejected outright before
// ever reaching a byte comparison. The payload side is bounded (200 chars
// is generous for {"id": <uuid>, "iat": <number>}) so nothing unbounded is
// ever handed to a decoder.
const MAX_PAYLOAD_B64_LENGTH = 200;
const SIGNATURE_B64_LENGTH = 43;
const BASE64URL_CHARS = /^[A-Za-z0-9_-]+$/;

const contextPayloadSchema = z
  .object({
    id: z.string().uuid(),
    iat: z.number().int().nonnegative(),
  })
  // Strict: the context format is deliberately exactly these two fields,
  // not "these fields plus anything else" — an extra field is treated the
  // same as any other malformed token.
  .strict();

function getSecret(): string {
  const secret = process.env.CAL_BOOKING_CONTEXT_SECRET;
  if (!secret) {
    throw new Error("CAL_BOOKING_CONTEXT_SECRET must be set in the server environment.");
  }
  return secret;
}

function sign(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

export function signBookingContext(inquiryId: string): string {
  // Validate before signing — never generate a token that its own
  // verifier would reject.
  if (!z.string().uuid().safeParse(inquiryId).success) {
    throw new Error("signBookingContext: inquiryId must be a valid UUID.");
  }
  const payload = JSON.stringify({ id: inquiryId, iat: Math.floor(Date.now() / 1000) });
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
  const signature = sign(payloadB64, getSecret());
  return `${payloadB64}.${signature}`;
}

export type VerifyBookingContextResult = { ok: true; inquiryId: string } | { ok: false };

// Every failure path returns the identical { ok: false } — never a reason
// code — so a caller can't be used as an oracle for which check failed or
// whether a given id exists.
export function verifyBookingContext(token: string): VerifyBookingContextResult {
  // Exactly one dot: reject anything else (zero, or more than one) before
  // any decoding is attempted.
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false };
  const [payloadB64, signatureB64] = parts;

  // Canonical shape: unpadded base64url charset only (no '=', no
  // whitespace, no other characters), bounded length. Node's base64url
  // decoder is otherwise permissive about padding/garbage, so this shape
  // check runs first rather than relying on decoder leniency.
  if (
    payloadB64.length === 0 ||
    payloadB64.length > MAX_PAYLOAD_B64_LENGTH ||
    !BASE64URL_CHARS.test(payloadB64) ||
    signatureB64.length !== SIGNATURE_B64_LENGTH ||
    !BASE64URL_CHARS.test(signatureB64)
  ) {
    return { ok: false };
  }

  // Canonical re-encoding check: decode then re-encode the payload
  // component and require exact string equality with what was received.
  // This catches non-canonical base64url that happens to decode to the
  // same bytes a canonical encoder would never produce (trailing bits set
  // when a canonical encoder would leave them zero) — a legitimately
  // signed token is always already in its own canonical form, so this
  // never rejects anything genuine.
  let payloadBytes: Buffer;
  try {
    payloadBytes = Buffer.from(payloadB64, "base64url");
  } catch {
    return { ok: false };
  }
  if (payloadBytes.toString("base64url") !== payloadB64) return { ok: false };

  // getSecret() is deliberately OUTSIDE any try/catch here: a missing
  // CAL_BOOKING_CONTEXT_SECRET is a genuine configuration fault, not "this
  // token is invalid" — it must propagate to the caller as a thrown
  // exception so route.ts can return 502 (retry-worthy, alerting-worthy)
  // rather than a silent 200 no-op that looks identical to a normal
  // rejected token.
  const secret = getSecret();
  let actual: Buffer;
  try {
    actual = Buffer.from(signatureB64, "base64url");
  } catch {
    return { ok: false };
  }
  const expected = Buffer.from(sign(payloadB64, secret), "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { ok: false };
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(payloadBytes.toString("utf8"));
  } catch {
    return { ok: false };
  }

  const parsed = contextPayloadSchema.safeParse(decoded);
  if (!parsed.success) return { ok: false };

  const nowMs = Date.now();
  const iatMs = parsed.data.iat * 1000;
  if (iatMs > nowMs + MAX_FUTURE_SKEW_MS) return { ok: false };
  if (nowMs - iatMs > MAX_AGE_MS) return { ok: false };

  return { ok: true, inquiryId: parsed.data.id };
}
