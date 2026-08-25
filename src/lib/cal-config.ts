import "server-only";

// Exactly "<username>/<slug>": no leading/trailing slash, no extra path
// segments, no query string or fragment, no whitespace, and — since a full
// URL like "https://cal.com/mintapp/mintapp-discovery-call" contains ':'
// and extra '/' characters this pattern doesn't allow — no scheme/host
// either. A previous version used link.split("/").pop(), which silently
// accepted all of the malformed shapes above; this rejects them outright.
const CAL_LINK_PATTERN = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/;

// NEXT_PUBLIC_CAL_LINK is intentionally public (it's the calLink the
// browser embed renders) but read here too so the server-side event-type
// slug check derives from the exact same single source of truth as the
// client, rather than a second, independently-configured value that could
// drift out of sync with it.
export function getCalEventTypeSlug(): string {
  const link = process.env.NEXT_PUBLIC_CAL_LINK;
  if (!link) {
    throw new Error("NEXT_PUBLIC_CAL_LINK must be set in the server environment.");
  }
  if (!CAL_LINK_PATTERN.test(link)) {
    throw new Error('NEXT_PUBLIC_CAL_LINK must be exactly "<username>/<slug>" — no URL, slashes, query string, or whitespace.');
  }
  return link.split("/")[1];
}

export function getCalEventTypeId(): number {
  const raw = process.env.CAL_EVENT_TYPE_ID;
  if (!raw) {
    throw new Error("CAL_EVENT_TYPE_ID must be set in the server environment.");
  }
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("CAL_EVENT_TYPE_ID must be a positive integer.");
  }
  return id;
}

export function getCalWebhookSecret(): string {
  const secret = process.env.CAL_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("CAL_WEBHOOK_SECRET must be set in the server environment.");
  }
  return secret;
}
