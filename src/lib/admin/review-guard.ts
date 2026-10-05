import "server-only";
import { getSqlGateway } from "@/lib/sql-gateway";
import { appSurface } from "./surface";

type Env = Record<string, string | undefined>;

// A Vercel Preview of the admin application must only ever show the isolated
// synthetic review database, never real client inquiries. Before any
// dashboard read or write on a Preview, the database must identify itself
// through public.review_environment() (supabase/review/01_review_marker.sql),
// which exists only in the review project. A Preview pointed at any other
// database, including production, refuses to show or change anything.

export const reviewGuardApplies = (env: Env = process.env) => appSurface(env) === "admin" && env.VERCEL_ENV === "preview";

let verified: Promise<boolean> | null = null;

export async function assertSyntheticReviewDatabase(env: Env = process.env): Promise<void> {
  if (!reviewGuardApplies(env)) return;
  verified ??= getSqlGateway()
    .call<string>("review_environment")
    .then((marker) => marker === "synthetic-review")
    .catch(() => false);
  if (await verified) return;
  verified = null;
  console.error("review_database_not_verified");
  throw new Error("review_database_not_verified");
}

// For tests only.
export const resetReviewGuard = () => {
  verified = null;
};
