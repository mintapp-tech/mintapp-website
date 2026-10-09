// The optional "existing website or app" link on the Start Project form. Shared by
// the form (early feedback) and the server (the rule that counts). No dependencies.
//
// Accepted: a public http(s) address with a real host name, up to 300 characters,
// written with or without "https://". Refused: other schemes (javascript:, data:,
// file:, ftp: ...), user names or passwords in the address, IP addresses, localhost
// and single-word hosts, and anything that is not a valid URL. The fragment is
// dropped. Nothing ever fetches the link: it is stored as text for the team.

export const EXISTING_LINK_MAX = 300;

const HOST = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function normalizeExistingLink(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw || raw.length > EXISTING_LINK_MAX) return null;
  if (/[\s<>"'`\\]/.test(raw)) return null;
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw);
  if (hasScheme && !/^https?:\/\//i.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(hasScheme ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (!HOST.test(host) || host.endsWith(".local") || host.endsWith(".localhost") || host.endsWith(".internal")) return null;
  if (url.port && url.port !== "80" && url.port !== "443") return null;
  url.hash = "";
  const out = url.toString();
  return out.length <= EXISTING_LINK_MAX ? out : null;
}
