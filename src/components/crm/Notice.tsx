import type { CrmMessages } from "@/lib/admin/crm-messages";

// A result banner after a form post. The code in the address (?n= or ?e=) only
// selects one of a fixed set of messages; anything else is ignored, so a link
// cannot put text on the page.
export default function Notice({ n, e, t }: { n?: string | string[]; e?: string | string[]; t: Pick<CrmMessages, "notices" | "errors"> }) {
  const ok = typeof n === "string" && Object.hasOwn(t.notices, n) ? t.notices[n] : undefined;
  const bad = typeof e === "string" && Object.hasOwn(t.errors, e) ? t.errors[e] : undefined;
  if (!ok && !bad) return null;
  return bad ? (
    <p role="alert" data-notice="error" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] font-medium text-red-900">
      {bad}
    </p>
  ) : (
    <p role="status" data-notice="ok" className="mb-5 rounded-xl border border-mint/50 bg-mint-soft px-4 py-3 text-[14px] font-medium text-mint-deep">
      {ok}
    </p>
  );
}
