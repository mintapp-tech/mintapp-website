import "server-only";

// Deployment config for the acknowledgment email sent to the client. Separate
// from the internal notification's variables on purpose: the two emails have
// different senders and reply addresses, and either can change without the
// other. Not secrets, but never NEXT_PUBLIC_: the browser has no use for them,
// and no address is written into the code.
export function getClientAckConfig() {
  const from = process.env.INQUIRY_ACK_FROM;
  const replyTo = process.env.INQUIRY_ACK_REPLY_TO;

  if (!from || !replyTo) {
    throw new Error("INQUIRY_ACK_FROM and INQUIRY_ACK_REPLY_TO must both be set in the server environment.");
  }

  return { from, replyTo };
}
