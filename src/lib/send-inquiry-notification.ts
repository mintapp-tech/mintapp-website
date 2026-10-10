import "server-only";
import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getNotificationConfig } from "./inquiry-notification-config";
import { resolveEmailSendingMode } from "./email-sending-mode";
import { buildInquiryNotificationEmail } from "./email/inquiry-notification-email";

export interface InquiryNotificationInput {
  inquiryId: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  /** The client's explicit choice on the form; absent for older cached forms. */
  projectType?: string;
  budget?: string;
  budgetCurrency?: string;
  timeline?: string;
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
      html: string;
      text: string;
    }) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
}

// The provider answered with an error. Carries only its error type, never its message.
class ProviderRejected extends Error {}

export function createRealResendSender(apiKey: string): EmailSender {
  return new Resend(apiKey);
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
 * assert on exactly which of the four states occurred without needing to
 * inspect logs.
 */
export async function sendInquiryNotification(
  supabase: SupabaseClient,
  sender: EmailSender | null,
  input: InquiryNotificationInput,
): Promise<"sent" | "send_failed" | "sent_but_bookkeeping_failed" | "disabled"> {
  let mode: ReturnType<typeof resolveEmailSendingMode>;
  try {
    mode = resolveEmailSendingMode();
  } catch (err) {
    // A misconfigured production environment is a real operational fault —
    // logged and marked "failed" like any other config problem below, so it
    // surfaces the same way (loudly, not silently) rather than being
    // confused with the intentional "disabled" path.
    console.error("Email sending mode misconfigured:", err instanceof Error ? err.message : err);
    await updateStatus(supabase, input.inquiryId, "failed");
    return "send_failed";
  }

  if (mode === "disabled") {
    // Intentionally never attempted (non-production default, explicit
    // production opt-out, or a test/CI run). "pending" would falsely imply
    // this is still expected to happen and risk a later accidental retry —
    // recorded as its own distinct, honest state instead (requires the
    // 20260823120000 migration to have been applied first).
    console.error("email_sending_disabled: skipping notification email");
    await updateStatus(supabase, input.inquiryId, "disabled");
    return "disabled";
  }

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
    // HTML for reading, with the plain-text version as the alternative part.
    const email = buildInquiryNotificationEmail({ ...input, submittedAt: new Date() });
    const { error } = await sender.emails.send({
      from: config.from,
      to: config.to,
      replyTo: config.replyTo,
      // Fixed subject: removes any header-injection surface entirely. The
      // client's details only ever appear in the body.
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    // The provider's message can quote the recipient or the content, so only its
    // error type is kept (a thrown exception is reported as "unexpected_error").
    if (error) throw new ProviderRejected((error as { name?: string }).name ?? "provider_error");
  } catch (err) {
    console.error("inquiry_notification_send_failed", err instanceof ProviderRejected ? err.message : "unexpected_error");
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

async function updateStatus(supabase: SupabaseClient, inquiryId: string, status: "failed" | "disabled") {
  const { error } = await supabase.from("project_inquiries").update({ notification_status: status }).eq("id", inquiryId);
  if (error) {
    console.error(`Failed to record notification status "${status}":`, error.message);
  }
}
