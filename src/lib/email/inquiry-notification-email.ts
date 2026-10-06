import { isProjectType, PROJECT_TYPE_LABELS_EN } from "../project-types";
import { EMAIL_COLORS as C, button, escapeHtml, heading, paragraph, renderLayout, type RenderedEmail } from "./layout";

// Internal notification to the Mintapp team for a new Start Project inquiry.
// The subject stays fixed and generic: no client name, company or idea ever
// appears in a subject line (it is visible in previews and notifications).

export interface InquiryNotificationEmailInput {
  inquiryId: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  /** The client's explicit choice on the form; anything else means "not provided". */
  projectType?: string | null;
  lang: string;
  desc: string;
  submittedAt: Date;
  siteUrl?: string;
}

export const INQUIRY_NOTIFICATION_SUBJECT = "New Mintapp project inquiry";

const LANGUAGE_NAMES: Record<string, string> = { en: "English", ar: "Arabic" };

const FONT = "Manrope, 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif";

function row(label: string, valueHtml: string): string {
  return `<tr>
  <td valign="top" style="padding:10px 16px 10px 0;width:118px;border-bottom:1px solid ${C.lineSoft};font-family:${FONT};font-size:14px;line-height:1.5;color:${C.inkSoft};">${escapeHtml(label)}</td>
  <td valign="top" style="padding:10px 0;border-bottom:1px solid ${C.lineSoft};font-family:${FONT};font-size:15px;line-height:1.5;color:${C.ink};word-break:break-word;">${valueHtml}</td>
</tr>`;
}

const projectTypeLabel = (value: string | null | undefined) => (isProjectType(value) ? PROJECT_TYPE_LABELS_EN[value] : "Not provided");

function formatSubmitted(date: Date): string {
  return `${date.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;
}

export function buildInquiryNotificationEmail(input: InquiryNotificationEmailInput): RenderedEmail {
  const language = LANGUAGE_NAMES[input.lang] ?? input.lang;
  const submitted = formatSubmitted(input.submittedAt);
  const mailto = `mailto:${input.email}`;
  const projectType = projectTypeLabel(input.projectType);

  const details = [
    row("Name", `<bdi>${escapeHtml(input.name)}</bdi>`),
    row("Email", `<a href="${escapeHtml(mailto)}" style="color:${C.mintDeep};text-decoration:underline;">${escapeHtml(input.email)}</a>`),
    input.phone ? row("Phone", `<span dir="ltr">${escapeHtml(input.phone)}</span>`) : "",
    input.company ? row("Company", `<bdi>${escapeHtml(input.company)}</bdi>`) : "",
    row("Project type", escapeHtml(projectType)),
    row("Language", escapeHtml(language)),
    row("Submitted", escapeHtml(submitted)),
    row("Inquiry ID", `<span style="font-family:Consolas,Menlo,monospace;font-size:13px;color:${C.inkSoft};">${escapeHtml(input.inquiryId)}</span>`),
  ].join("\n");

  const content = [
    heading("en", "New project inquiry"),
    paragraph("en", "A new inquiry came in through the Start Project form. The client sees the booking step right after sending.", { muted: true, spaceAfter: 20 }),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;border-top:1px solid ${C.lineSoft};">
${details}
</table>`,
    `<p style="margin:0 0 8px;font-family:${FONT};font-size:14px;font-weight:700;color:${C.ink};">Project description</p>`,
    // dir="auto": an Arabic description renders right to left on its own.
    `<div dir="auto" style="margin:0 0 24px;padding:16px 18px;background:${C.canvas};border-radius:10px;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.ink};white-space:pre-wrap;word-break:break-word;">${escapeHtml(input.desc)}</div>`,
    button("en", mailto, "Email the client"),
  ].join("\n");

  const html = renderLayout({
    lang: "en",
    title: INQUIRY_NOTIFICATION_SUBJECT,
    preheader: "A new Start Project inquiry is ready for review.",
    content,
    footer: ["Internal notification for the Mintapp team. It contains client details; keep it within the team."],
    siteUrl: input.siteUrl,
  });

  const text = [
    `Inquiry ID: ${input.inquiryId}`,
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    input.phone ? `Phone: ${input.phone}` : null,
    input.company ? `Company: ${input.company}` : null,
    `Project type: ${projectType}`,
    `Preferred language: ${language}`,
    `Submitted: ${submitted}`,
    "",
    "Project description:",
    input.desc,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return { subject: INQUIRY_NOTIFICATION_SUBJECT, html, text };
}
