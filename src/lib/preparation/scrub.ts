// Removes contact details from free text before it goes to any generator or
// into a prompt a person copies into their own Claude chat. The client typed
// the brief themselves and may have put their email, phone number, website,
// social handle, name or company in it; none of that is needed to prepare for a
// first meeting. Figures that are part of the brief (counts, prices, durations,
// dates) are kept, because the draft's evidence must quote the brief.

export const REMOVED = "[removed]";

// Arabic-Indic and Persian digits count as digits.
const DIGIT = "[0-9\\u0660-\\u0669\\u06F0-\\u06F9]";

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu;
const URL_WITH_SCHEME = /\b[a-z][a-z0-9+.-]*:\/\/[^\s<>"')\]]+/gi;
const WWW = /\bwww\.[^\s<>"')\]]+/gi;
const TLDS = "com|net|org|io|co|app|dev|ai|me|tech|eg|sa|ae|kw|qa|bh|om|jo|lb|ma|tn|dz|uk|us|info|biz|xyz|online|site|store|shop|agency|design|studio|cloud|digital|so|ly|gg|tv";
const BARE_DOMAIN = new RegExp(`(?<![\\p{L}\\p{N}@.-])[a-z0-9][a-z0-9-]*(?:\\.[a-z0-9][a-z0-9-]*)*\\.(?:${TLDS})(?![\\p{L}\\p{N}-])(?:/[^\\s<>"')\\]]*)?`, "giu");
const HANDLE = /(?<![\p{L}\p{N}_@])@[\p{L}\p{N}_.]{3,}/gu;
// A run of digits with the separators people use in phone numbers: at least
// nine digits, or a leading plus and at least seven. Dates, ranges and prices
// have fewer digits and are left alone.
const PHONE = new RegExp(`(?<![\\p{L}\\p{N}])(?:\\+|00)?\\(?${DIGIT}(?:[\\s().-]{0,2}${DIGIT}){6,}(?![\\p{L}\\p{N}])`, "gu");

const digitsIn = (s: string) => (s.match(new RegExp(DIGIT, "g")) ?? []).length;
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function scrubContactDetails(text: string, known: readonly (string | null | undefined)[] = []): string {
  let out = text;
  // The inquiry's own name, company, email and phone, wherever they appear.
  for (const value of known) {
    const v = value?.trim();
    if (!v || v.length < 3) continue;
    out = out.replace(new RegExp(escapeRegExp(v), "giu"), REMOVED);
  }
  // A link or domain ends before the punctuation that closes the sentence around it.
  const link = (m: string) => REMOVED + (/[.,;:!?،؛]+$/.exec(m)?.[0] ?? "");
  out = out.replace(EMAIL, REMOVED).replace(URL_WITH_SCHEME, link).replace(WWW, link).replace(BARE_DOMAIN, link).replace(HANDLE, REMOVED);
  out = out.replace(PHONE, (m) => {
    const digits = digitsIn(m);
    return digits >= 9 || (/^(\+|00)/.test(m) && digits >= 7) ? REMOVED : m;
  });
  return out;
}

// The values worth looking for in a brief, from the inquiry's own contact fields.
export function knownDetails(inquiry: { client_name?: string | null; company_name?: string | null; email?: string | null; phone?: string | null; company_url?: string | null }): string[] {
  const host = inquiry.company_url?.trim().replace(/^[a-z]+:\/\//i, "").replace(/^www\./i, "").replace(/[/?#].*$/, "");
  const phoneDigits = inquiry.phone?.replace(/\D/g, "");
  return [inquiry.client_name, inquiry.company_name, inquiry.email, inquiry.phone, host, phoneDigits && phoneDigits.length >= 7 ? phoneDigits : null].filter((v): v is string => Boolean(v && v.trim()));
}
