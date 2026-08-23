import { NextRequest, NextResponse, after } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createRealResendSender, sendInquiryNotification } from "@/lib/send-inquiry-notification";
import { insertInquiry } from "@/lib/insert-inquiry";
import { findInquiryIdByToken } from "@/lib/find-inquiry-by-token";
import { verifyTurnstileToken } from "@/lib/verify-turnstile";
import { getTurnstileSecretKey, getAllowedTurnstileHostnames } from "@/lib/turnstile-config";
import { inquirySchema } from "@/lib/inquiry-schema";
import { INQUIRY_LIMITS } from "@/lib/inquiry-limits";
import type { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TURNSTILE_ACTION = "start_project";

// Comfortably larger than the largest realistic legitimate payload (a
// 5,000-character Arabic description alone can be ~10KB in UTF-8, since
// Arabic script runs ~2 bytes/char) while still being a firm, meaningful
// ceiling — nowhere near the live description_length constraint's 8,000
// character (not byte) limit.
const MAX_BODY_BYTES = 50 * 1024;

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function jsonResponse(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

// A bot that fills the honeypot or submits implausibly fast gets a response
// indistinguishable from a real success — telling it exactly what tripped
// would just teach it to route around that check next time. Nothing is
// inserted; the id is generated but never written anywhere.
function fakeSuccessResponse() {
  return jsonResponse({ id: crypto.randomUUID() }, 201);
}

type ReadResult = { ok: true; data: unknown } | { ok: false; status: number; error: string };

async function readJsonWithLimit(request: NextRequest): Promise<ReadResult> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return { ok: false, status: 415, error: "Unsupported content type." };
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength && Number(declaredLength) > MAX_BODY_BYTES) {
    return { ok: false, status: 413, error: "Payload too large." };
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return { ok: false, status: 400, error: "Invalid request body." };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      // Deliberately not logging the (oversized, truncated) body itself.
      return { ok: false, status: 413, error: "Payload too large." };
    }
    chunks.push(value);
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(combined);
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400, error: "Invalid request body." };
  }
}

// Stable, controlled codes only — never Zod's own messages, its internal
// issue-code names, or anything that reveals schema shape. The client maps
// each code to localized copy; this list is the entire contract between
// them.
function issueToCode(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case "invalid_type":
      return "required";
    case "too_small":
      return "too_short";
    case "too_big":
      return "too_long";
    case "invalid_format":
      return "format" in issue && issue.format === "email" ? "invalid_email" : "invalid_format";
    case "invalid_value":
      if (issue.path[0] === "consent") return "consent_required";
      if (issue.path[0] === "lang") return "invalid_locale";
      return "invalid_value";
    default:
      return "invalid";
  }
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issueToCode(issue);
  }
  return out;
}

export async function POST(request: NextRequest) {
  // 1–4: method (framework-level), content-type, size, parse.
  const read = await readJsonWithLimit(request);
  if (!read.ok) {
    return jsonResponse({ error: read.error }, read.status);
  }

  // 5: structural/Zod validation, before any business logic runs at all —
  // including the honeypot, whose "must be empty" rule is a business-logic
  // check applied to the already-typed value below, never a schema failure
  // (see inquiry-schema.ts for why).
  const parsed = inquirySchema.safeParse(read.data);
  if (!parsed.success) {
    return jsonResponse({ error: "Invalid submission.", fields: fieldErrors(parsed.error) }, 400);
  }

  const body = parsed.data;

  // 6: honeypot.
  if (body.honeypot.length > 0) {
    return fakeSuccessResponse();
  }

  // 7: timing. Too fast is a bot signal (silent fake success, same
  // reasoning as the honeypot). Too stale is a legitimate UX case — the tab
  // sat open for hours — so that gets an honest, actionable error instead.
  const startedAt = Date.parse(body.formStartedAt);
  if (Number.isNaN(startedAt)) {
    return jsonResponse({ error: "Invalid submission." }, 400);
  }
  const elapsedMs = Date.now() - startedAt;
  if (elapsedMs < INQUIRY_LIMITS.minSubmitSeconds * 1000) {
    return fakeSuccessResponse();
  }
  if (elapsedMs > INQUIRY_LIMITS.maxFormAgeMs) {
    return jsonResponse({ error: "This form has expired. Please refresh the page and try again." }, 400);
  }

  // 8: Turnstile — verified before any Supabase call, on every request
  // including retries of an already-stored submissionToken. A retry must
  // carry a fresh, valid token; an old/spent one does not get to skip this
  // step just because the token happens to be a known submissionToken.
  const forwardedFor = request.headers.get("x-forwarded-for");
  const turnstileResult = await verifyTurnstileToken(body.turnstileToken, {
    secretKey: getTurnstileSecretKey(),
    expectedAction: TURNSTILE_ACTION,
    allowedHostnames: getAllowedTurnstileHostnames(),
    remoteIp: forwardedFor?.split(",")[0]?.trim(),
  });

  if (!turnstileResult.ok) {
    if (turnstileResult.reason === "invalid") {
      // Collapses "Cloudflare said no," "wrong hostname," and "wrong
      // action" into one identical response — no oracle for which
      // specific check failed.
      return jsonResponse({ error: "Verification failed. Please try again.", code: "turnstile_failed" }, 403);
    }
    return jsonResponse({ error: "Please try again shortly.", code: "turnstile_unavailable" }, 503);
  }

  const supabase = getSupabaseServerClient();

  // 9: idempotency lookup — only after Turnstile has passed.
  const existingId = await findInquiryIdByToken(supabase, body.submissionToken);
  if (existingId) {
    return jsonResponse({ id: existingId, alreadyReceived: true }, 200);
  }

  // 10: insert, with its own reactive unique-conflict handling for the rare
  // case where two requests both reach this point for the same token before
  // either has inserted (each must have independently passed Turnstile).
  const result = await insertInquiry(supabase, body);

  if (result.status === "failed") {
    // The real error (result.message) is only ever logged server-side
    // inside insertInquiry() — never returned to the client.
    return jsonResponse({ error: "Could not store your inquiry. Please try again." }, 502);
  }

  if (result.status === "duplicate") {
    return jsonResponse({ id: result.id, alreadyReceived: true }, 200);
  }

  const inquiryId = result.id;

  const apiKey = process.env.RESEND_API_KEY;
  const sender = apiKey ? createRealResendSender(apiKey) : null;

  // 11: the inquiry is already durably stored — the client's submission is
  // a success from here on. Email notification is best-effort and must
  // never block or fail the response. `after()` guarantees this still runs
  // to completion on Vercel even though the response has already been sent.
  after(() =>
    sendInquiryNotification(supabase, sender, {
      inquiryId,
      name: body.name,
      email: body.email,
      phone: body.phone,
      company: body.company,
      lang: body.lang,
      desc: body.desc,
    }),
  );

  // 12: success response.
  return jsonResponse({ id: inquiryId }, 201);
}
