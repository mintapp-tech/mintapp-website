// Shared, email-safe layout for every email Mintapp sends itself (Cal.com's
// booking emails are Cal.com's own and cannot be styled from here).
//
// Rules this file keeps for every template:
//  - table layout and inline styles only; the single <style> block is a
//    progressive enhancement for small screens, never required;
//  - one image (the Mintapp mark, served from our own site), decorative, with
//    the name "mintapp" always present as live text, so a blocked image loses
//    nothing; no tracking pixels, web fonts or third-party resources;
//  - every value that can come from a visitor goes through escapeHtml().
// Relative imports only, so the preview script can load these files directly.

export type EmailLang = "en" | "ar";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export const SITE_URL = "https://www.mintapp.tech";
export const CONTACT_EMAIL = "hello@mintapp.tech";

// Site tokens (src/app/globals.css). Text colors are checked for WCAG AA
// contrast against the backgrounds they sit on in email.test.ts.
export const EMAIL_COLORS = {
  canvas: "#f7f8f4",
  surface: "#ffffff",
  ink: "#0a0d0c",
  inkSoft: "#4f5955",
  inkFaint: "#6b736f",
  line: "#dce2de",
  lineSoft: "#e8ece9",
  dark: "#071b16",
  mintDeep: "#0a6b50",
  mint: "#32e6a6",
  mintSoft: "#ddf9ed",
} as const;
const C = EMAIL_COLORS;

const FONTS: Record<EmailLang, string> = {
  en: "Manrope, 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif",
  ar: "Alexandria, 'Segoe UI', Tahoma, 'Geeza Pro', Arial, sans-serif",
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const start = (lang: EmailLang) => (lang === "ar" ? "right" : "left");

export function paragraph(lang: EmailLang, html: string, opts: { muted?: boolean; spaceAfter?: number } = {}): string {
  const color = opts.muted ? C.inkSoft : C.ink;
  return `<p style="margin:0 0 ${opts.spaceAfter ?? 16}px;font-family:${FONTS[lang]};font-size:16px;line-height:1.65;color:${color};text-align:${start(lang)};">${html}</p>`;
}

export function heading(lang: EmailLang, text: string): string {
  return `<h1 style="margin:0 0 20px;font-family:${FONTS[lang]};font-size:24px;line-height:1.3;font-weight:700;color:${C.ink};text-align:${start(lang)};">${escapeHtml(text)}</h1>`;
}

export function link(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="color:${C.mintDeep};text-decoration:underline;">${escapeHtml(label)}</a>`;
}

// A "bulletproof" button: the colored table cell carries the background, so
// clients that ignore padding on links still show a solid, clickable button.
export function button(lang: EmailLang, href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${start(lang)}" style="margin:8px 0 24px;border-collapse:separate;">
  <tr>
    <td bgcolor="${C.mintDeep}" style="border-radius:10px;background:${C.mintDeep};">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 24px;font-family:${FONTS[lang]};font-size:16px;line-height:1.2;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>
<div style="clear:both;line-height:0;font-size:0;">&nbsp;</div>`;
}

export interface LayoutInput {
  lang: EmailLang;
  /** Document title; the subject line. */
  title: string;
  /** Inbox preview line, hidden in the body. */
  preheader: string;
  /** Already-escaped HTML built from the helpers above. */
  content: string;
  /** Already-escaped footer lines. */
  footer: string[];
  siteUrl?: string;
}

export function renderLayout({ lang, title, preheader, content, footer, siteUrl = SITE_URL }: LayoutInput): string {
  const dir = lang === "ar" ? "rtl" : "ltr";
  const font = FONTS[lang];
  const footerHtml = footer
    .map((line) => `<p style="margin:0 0 8px;font-family:${font};font-size:13px;line-height:1.6;color:${C.inkFaint};text-align:${start(lang)};">${line}</p>`)
    .join("\n");

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(title)}</title>
<style>
  @media (max-width: 600px) {
    .mt-outer { padding: 20px 12px !important; }
    .mt-card { padding: 28px 22px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.canvas};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.canvas};">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="${dir}" bgcolor="${C.canvas}" style="background:${C.canvas};">
  <tr>
    <td class="mt-outer" align="center" style="padding:36px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="${dir}" style="max-width:560px;">
        <tr>
          <td style="padding:0 4px 18px;text-align:${start(lang)};">
            <a href="${siteUrl}" style="text-decoration:none;color:${C.ink};">
              <img src="${siteUrl}/email/mintapp-mark.png" width="36" height="36" alt="" style="display:inline-block;vertical-align:middle;border:0;outline:none;">
              <span dir="ltr" style="display:inline-block;vertical-align:middle;margin:0 8px;font-family:${FONTS.en};font-size:19px;font-weight:700;letter-spacing:-0.5px;color:${C.ink};">mintapp</span>
            </a>
          </td>
        </tr>
        <tr>
          <td class="mt-card" bgcolor="${C.surface}" style="background:${C.surface};border:1px solid ${C.line};border-top:4px solid ${C.mint};border-radius:16px;padding:36px 36px 28px;">
${content}
          </td>
        </tr>
        <tr>
          <td style="padding:22px 8px 0;">
${footerHtml}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
