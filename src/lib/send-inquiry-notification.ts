import "server-only";
import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getNotificationConfig } from "./inquiry-notification-config";

export interface InquiryNotificationInput {
  inquiryId: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  lang: string;
  desc: string;
}

// Minimal shape of what this module needs from a Resend client — lets tests
// pass a fully fake object instead of a real `Resend` instance, so no test
// run ever makes a real network call to Resend's API.
export interface EmailSender {
  emails: {
    send: (args: {
      from: string;
      to: string;
      replyTo: string;
      subject: string;
      text: string;
    }) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
}

export function createRealResendSender(apiKey: string): EmailSender {
  return new Resend(apiKey);
}

function buildEmailBody(input: InquiryNotificationInput): string {
  const lines = [
    `Inquiry ID: ${input.inquiryId}`,
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    input.phone ? `Phone: ${input.phone}` : null,
    input.company ? `Company: ${input.company}` : null,
    `Preferred language: ${input.lang}`,
    `Submitted: ${new Date().toISOString()}`,
    "",
    "Project description:",
    input.desc,
  ].filter((line): line is string => line !== null);
  return lines.join("\n");
}

/**
 * Three independent, separately-observable steps:
 *  1. attempt the send
 *  2. record the result
 *  3. bookkeeping (Supabase status update) — kept isolated from step 1's
 *     try/catch so a bookkeeping failure after a *successful* send is never
 *     mislabeled as a send failure (see route.ts for the incident this
 *     fixes: an email can genuinely send while the follow-up status write
 *     fails, e.g. a transient Supabase blip).
 *
 * Returns a result object rather than throwing, so callers (and tests) can
 * assert on exactly which of the three states occurred without needing to
 * inspect logs.
 */
export async function sendInquiryNotification(
  supabase: SupabaseClient,
  sender: EmailSender | null,
  input: InquiryNotificationInput,
): Promise<"sent" | "send_failed" | "sent_but_bookkeeping_failed"> {
  if (!sender) {
    console.error("No email sender configured — skipping notification email.");
    await updateStatus(supabase, input.inquiryId, "failed");
    return "send_failed";
  }

  let config: ReturnType<typeof getNotificationConfig>;
  try {
    config = getNotificationConfig();
  } catch (err) {
    console.error("Notification config missing:", err instanceof Error ? err.message : err);
    await updateStatus(supabase, input.inquiryId, "failed");
    return "send_failed";
  }

  try {
    const { error } = await sender.emails.send({
      from: config.from,
      to: config.to,
      replyTo: config.replyTo,
      // Fixed subject: removes any header-injection surface entirely. The
      // client's name only ever appears in the plain-text body below.
      subject: "New Mintapp project inquiry",
      text: buildEmailBody(input),
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("Resend send failed:", err instanceof Error ? err.message : err);
    await updateStatus(supabase, input.inquiryId, "failed");
    return "send_failed";
  }

  try {
    const { error } = await supabase
      .from("project_inquiries")
      .update({ notification_status: "sent", notification_sent_at: new Date().toISOString() })
      .eq("id", input.inquiryId);
    if (error) throw error;
    return "sent";
  } catch (err) {
    console.error(
      "Email sent successfully but the notification_status bookkeeping update failed:",
      err instanceof Error ? err.message : err,
    );
    // Deliberately not writing "failed" here — the email did send. Left as
    // "pending" (its state since insert) so it can be found later with:
    //   select * from project_inquiries
    //   where notification_status = 'pending' and created_at < now() - interval '1 hour';
    return "sent_but_bookkeeping_failed";
  }
}

async function updateStatus(supabase: SupabaseClient, inquiryId: string, status: "failed") {
  const { error } = await supabase.from("project_inquiries").update({ notification_status: status }).eq("id", inquiryId);
  if (error) {
    console.error("Failed to record notification failure status:", error.message);
  }
}
