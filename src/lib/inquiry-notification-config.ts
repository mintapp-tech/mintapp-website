import "server-only";

// Non-secret deployment config for the inquiry notification email. Not
// secrets — moved to env vars for safer deployment/testing (e.g. a staging
// environment sending to a different inbox) rather than a hardcoded literal
// that requires a code change to adjust. Still never NEXT_PUBLIC_: the
// browser has no legitimate reason to know these values.
export function getNotificationConfig() {
  const from = process.env.INQUIRY_NOTIFICATION_FROM;
  const to = process.env.INQUIRY_NOTIFICATION_TO;
  const replyTo = process.env.INQUIRY_NOTIFICATION_REPLY_TO;

  if (!from || !to || !replyTo) {
    throw new Error(
      "INQUIRY_NOTIFICATION_FROM, INQUIRY_NOTIFICATION_TO and INQUIRY_NOTIFICATION_REPLY_TO must all be set in the server environment.",
    );
  }

  return { from, to, replyTo };
}
