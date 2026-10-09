import { adminState } from "@/lib/admin/auth/state";
import { isSameOrigin } from "@/lib/admin/csrf";
import { exportRows } from "@/lib/crm/data";
import { EXPORT_COLUMNS, toCsv } from "@/lib/crm/csv";
import { exportKind } from "@/lib/crm/schemas";
import { todayInCairo } from "@/components/dashboard/ui";

// CSV exports. POST only, from a form on the admin site itself: the request must
// name this host as its origin (a second layer beside the SameSite=Strict
// session cookie), the person must be fully signed in, and every export is
// written to the activity trail by the database. Cells that a spreadsheet could
// run as a formula are exported as text.

export const dynamic = "force-dynamic";

const refuse = (status: number) => new Response(null, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  if (!isSameOrigin(request.headers)) return refuse(403);
  const state = await adminState();
  if (state.status !== "ok") return refuse(401);
  const kind = exportKind.safeParse((await params).kind);
  if (!kind.success) return refuse(404);
  try {
    const rows = await exportRows(kind.data, state.member.email);
    const csv = toCsv(EXPORT_COLUMNS[kind.data], rows);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="mintapp-${kind.data}-${todayInCairo()}.csv"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    console.error("crm_export_failed");
    return refuse(500);
  }
}

// Anything else is not part of the application.
export const GET = () => refuse(405);
