import "server-only";
import type { EmailSender } from "./send-inquiry-notification";
import { resolveEmailSendingMode } from "./email-sending-mode";
import { getClientAckConfig } from "./client-ack-config";
import { signBookingContext } from "./cal-booking-context";
import { buildClientAcknowledgment, isValidCalLink, recoveryUrlFor } from "./email/client-acknowledgment";

export interface ClientAcknowledgmentInput {
  inquiryId: string;
  name: string;
  email: string;
  lang: "en" | "ar";
}

export type ClientAcknowledgmentResult = "sent" | "send_failed" | "disabled" | "not_configured";

/**
 * Tells the client we have their inquiry. Runs only after the inquiry has been
 * saved, and only for a newly saved inquiry: the route never reaches it for a
 * duplicate or a retry, so one inquiry gets one acknowledgment.
 *
 * It never throws and never touches the database: a failure is logged without
 * the client's address, name or any provider message, and the form submission
 * and the booking are unaffected. Like every email here it obeys
 * EMAIL_SENDING_MODE, so with sending disabled nothing is sent.
 */
export async function sendClientAcknowledgment(sender: EmailSender | null, input: ClientAcknowledgmentInput): Promise<ClientAcknowledgmentResult> {
  let mode: ReturnType<typeof resolveEmailSendingMode>;
  try {
    mode = resolveEmailSendingMode();
  } catch {
    console.error("client_ack_mode_misconfigured");
    return "send_failed";
  }
  if (mode === "disabled") {
    console.warn("client_ack_disabled: email sending is off, no acknowledgment sent");
    return "disabled";
  }
  if (!sender) {
    console.error("client_ack_not_configured: no email sender");
    return "not_configured";
  }

  let config: ReturnType<typeof getClientAckConfig>;
  try {
    config = getClientAckConfig();
  } catch {
    console.error("client_ack_not_configured: sender or reply-to address missing");
    return "not_configured";
  }

  // The button leads to our own booking page with the signed inquiry reference
  // (valid 30 days), which decides on the server whether to offer a scheduler.
  // The technical fallback (no button, "we will contact you") is used ONLY when
  // that link cannot be made: no calendar configured, or the reference could not
  // be signed. It is never used just because the client has not booked yet.
  let bookingUrl: string | undefined;
  if (!isValidCalLink(process.env.NEXT_PUBLIC_CAL_LINK)) {
    console.error("client_ack_fallback: no calendar is configured");
  } else {
    try {
      bookingUrl = recoveryUrlFor(input.lang, signBookingContext(input.inquiryId));
    } catch {
      console.error("client_ack_fallback: the booking reference could not be signed");
    }
  }

  try {
    const email = buildClientAcknowledgment({ lang: input.lang, name: input.name, bookingUrl });
    const { error } = await sender.emails.send({
      from: config.from,
      to: input.email,
      replyTo: config.replyTo,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    if (error) {
      // The provider's message can repeat the recipient; log only its type.
      console.error("client_ack_send_failed", (error as { name?: string }).name ?? "unknown_error");
      return "send_failed";
    }
    return "sent";
  } catch {
    console.error("client_ack_send_failed: unexpected error");
    return "send_failed";
  }
}
