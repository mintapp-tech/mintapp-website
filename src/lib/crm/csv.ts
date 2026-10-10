import { budgetLabel, timelineLabel } from "@/lib/form-options";

// CSV for exports opened in a spreadsheet. A cell that starts with =, +, -, @,
// a tab or a carriage return can be run as a formula by Excel, LibreOffice and
// Google Sheets ("CSV injection"), so such text cells get a leading apostrophe
// that makes the spreadsheet treat them as text. Numbers and dates the
// database produced are not text and are written as they are.

const FORMULA_START = /^[\s\u0000-\u001f]*[=+\-@]|^[\t\r]/;

export function safeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "yes" : "no";
  const text = Array.isArray(value) ? value.join(" & ") : typeof value === "object" ? JSON.stringify(value) : String(value);
  return FORMULA_START.test(text) ? `'${text}` : text;
}

const quote = (cell: string) => (/[",\r\n]/.test(cell) || cell !== cell.trim() ? `"${cell.replace(/"/g, '""')}"` : cell);

// A date-only or ISO date-time string from the database is data, not a formula.
const ISO = /^\d{4}-\d{2}-\d{2}([T ][\d:.+\-Z]+)?$/;

export function toCsv(columns: readonly string[], rows: readonly Record<string, unknown>[]): string {
  const line = (cells: string[]) => cells.map(quote).join(",");
  const body = rows.map((row) =>
    line(
      columns.map((c) => {
        const v = row[c];
        return typeof v === "string" && ISO.test(v) ? v : safeCell(v);
      }),
    ),
  );
  // A byte-order mark so Excel opens Arabic text as UTF-8; CRLF line ends.
  return `﻿${[line([...columns]), ...body].join("\r\n")}\r\n`;
}

export const EXPORT_COLUMNS = {
  inquiries: ["id", "received", "client", "company", "language", "project_type", "budget", "budget_currency", "timeline", "stage", "owners", "meeting", "meeting_at", "preparation", "origin", "source", "medium", "campaign", "content", "partner", "fit", "score", "loss_reason", "next_action", "next_action_owner", "next_action_due"],
  companies: ["id", "name", "website", "country", "sector", "language", "contacts", "created"],
  contacts: ["id", "name", "role", "company", "email", "phone", "language", "consent", "consent_at", "do_not_contact"],
  prospects: ["id", "company", "country", "pool", "origin", "contact", "role", "channel", "language", "fit", "score", "trigger", "owner", "stage", "next_action", "next_action_owner", "next_action_due", "outbound_touches", "last_touch", "closed_reason"],
} as const;

// Rows as people read them: the inquiries export shows the budget and timeline
// as English labels, never the stored codes. Other kinds are unchanged.
export function presentRows(kind: keyof typeof EXPORT_COLUMNS, rows: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  if (kind !== "inquiries") return [...rows];
  const text = (v: unknown) => (typeof v === "string" ? v : null);
  return rows.map((row) => ({
    ...row,
    budget: budgetLabel(text(row.budget), text(row.budget_currency), "en"),
    timeline: timelineLabel(text(row.timeline), "en"),
  }));
}
