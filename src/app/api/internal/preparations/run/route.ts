import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { runConfiguredPreparation } from "@/lib/preparation/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

// Runs one preparation worker pass. For a scheduler (e.g. Vercel Cron sends
// "Authorization: Bearer <secret>") or a manual retry. Requires
// PREPARATION_WORKER_SECRET; without it the endpoint is disabled. Responds
// with counts and categories only, never inquiry content.
function authorized(header: string | null, secret: string): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  const digest = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(digest(header.slice(7)), digest(secret));
}

export async function POST(request: NextRequest) {
  const secret = process.env.PREPARATION_WORKER_SECRET;
  if (!secret || secret.length < 32) return NextResponse.json({ ok: false, error: "disabled" }, { status: 503, headers: NO_STORE });
  if (!authorized(request.headers.get("authorization"), secret)) return NextResponse.json({ ok: false }, { status: 401, headers: NO_STORE });

  try {
    const outcome = await runConfiguredPreparation(3);
    return NextResponse.json({ ok: true, ...outcome }, { headers: NO_STORE });
  } catch {
    console.error("preparation_run_failed");
    return NextResponse.json({ ok: false }, { status: 502, headers: NO_STORE });
  }
}

export const GET = POST;
