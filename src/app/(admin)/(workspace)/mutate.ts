import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { teamMembers } from "@/lib/admin/auth/config";
import { CRM_MESSAGES } from "@/lib/admin/crm-messages";
import { SqlError } from "@/lib/sql-gateway";
import { formObject } from "@/lib/crm/schemas";

// Shared plumbing for the CRM's server actions. Each action first calls
// requireAdmin() itself (a layout is not re-run for an action), validates what
// was posted, does its work, and then redirects back to the page with a short
// code (?n= for success, ?e= for a problem) that the page turns into a message
// from a fixed list. Nothing the person typed is ever put in the address.

const KNOWN_ERRORS = new Set(Object.keys(CRM_MESSAGES.en.errors));

export function errorCodeOf(error: unknown): string {
  if (error instanceof z.ZodError) {
    const named = error.issues.map((i) => i.message).find((m) => KNOWN_ERRORS.has(m));
    return named ?? "invalid";
  }
  if (error instanceof SqlError) {
    if (KNOWN_ERRORS.has(error.code)) return error.code;
    return error.code === "invalid_input" ? "invalid" : "failed";
  }
  return "failed";
}

// Runs `work`, then sends the browser back to `path` (a server-built path,
// never user input) with the outcome. Logs only the function name and error
// code: never the data.
export async function mutate(path: string, ok: string, work: () => Promise<unknown>, anchor?: string): Promise<never> {
  let error: string | null = null;
  try {
    await work();
  } catch (e) {
    error = errorCodeOf(e);
    console.error(`crm_action_failed:${e instanceof SqlError ? `${e.fn}:${e.code}` : error}`);
  }
  revalidatePath(path);
  redirect(`${path}?${error ? `e=${error}` : `n=${ok}`}${anchor ? `#${anchor}` : ""}`);
}

export const parseForm = <S extends z.ZodType>(schema: S, form: FormData): z.output<S> => schema.parse(formObject(form));

export const uuid = (form: FormData, key: string) => z.string().uuid().parse(form.get(key));
export const optionalUuid = (form: FormData, key: string) => {
  const value = String(form.get(key) ?? "");
  return value === "" ? null : z.string().uuid().parse(value);
};

// A member id from the allowlist, or an error. Owners are always ids, never emails.
export function memberId(value: unknown): string {
  const id = z.string().parse(value);
  if (!teamMembers().some((m) => m.id === id)) throw new z.ZodError([{ code: "custom", message: "owners_shape", path: [], input: value }]);
  return id;
}
