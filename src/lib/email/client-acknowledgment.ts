import { CONTACT_EMAIL, EMAIL_COLORS, SITE_URL, button, escapeHtml, heading, link, paragraph, renderLayout, type EmailLang, type RenderedEmail } from "./layout";

// Sent to the client right after an inquiry has been saved.
//
// The normal flow: the client submits, the website shows the Cal.com scheduler
// straight away, and this email follows. So by default the email does not ask
// the client to book; it offers a way back: "If you haven't already chosen a
// time, you can select one below", with one button to the booking page. The
// client who already booked simply ignores it, and Cal.com sends the booking,
// reschedule and cancellation messages itself.
//
// There are two versions, and the second is NOT a second kind of email:
//
//   normal    a booking link is available. This is every ordinary submission.
//   fallback  no safe booking link could be made (no calendar is configured, or
//             the signed reference could not be created). It has no button and
//             says Mintapp will contact the client. It is chosen ONLY for those
//             technical reasons, never because the client has not booked yet.
//
// Deliberately promises no proposal, design or estimate (the site says none comes
// before the call), and never says Mintapp arranges every meeting by hand.

export interface ClientAcknowledgmentInput {
  lang: EmailLang;
  /** Used in the greeting only when it looks like a plain name; see greetingName(). */
  name?: string;
  /** The booking recovery link (see recoveryUrlFor). Absent only in the technical fallback. */
  bookingUrl?: string;
  siteUrl?: string;
}

export const CLIENT_ACK_COPY = {
  en: {
    subject: "We received your project inquiry",
    preheaderBook: "If you haven’t already chosen a time for your discovery call, you can do it here.",
    preheaderNoBook: "We have your inquiry and will contact you to arrange your discovery call.",
    heading: "We have your idea",
    hello: (name: string) => `Hi ${name},`,
    helloPlain: "Hello,",
    received: "Thank you for telling us about your idea. Your inquiry has reached the Mintapp team.",
    review: "Before we meet, we read what you sent, so the call can focus on your goals and questions.",
    bookIf: "If you haven’t already chosen a time, you can select one below.",
    action: "Choose a call time",
    confirmationNote: "Once you book, Cal.com sends the confirmation separately.",
    noBook: "We will contact you to arrange a time for a 30-minute discovery call.",
    questions: (email: string) => `Questions? Reply to this email or write to ${email}.`,
    signoff: "The Mintapp team",
    why: "You received this email because you sent a project inquiry on mintapp.tech.",
    privacy: "Privacy policy",
    textLink: "Choose a call time:",
  },
  ar: {
    subject: "وصلنا طلب مشروعك",
    preheaderBook: "إذا لم تكن قد اخترت موعدًا بعد، يمكنك اختياره من هنا.",
    preheaderNoBook: "وصلنا طلبك وسنتواصل معك لتحديد موعد مكالمتك التعريفية.",
    heading: "وصلتنا فكرتك",
    hello: (name: string) => `مرحبًا ${name}،`,
    helloPlain: "مرحبًا،",
    received: "شكرًا لمشاركتنا فكرتك. وصل طلبك إلى فريق Mintapp.",
    review: "قبل أن نلتقي، نقرأ ما أرسلته حتى تركّز المكالمة على أهدافك وأسئلتك.",
    bookIf: "إذا لم تكن قد اخترت موعدًا بعد، يمكنك اختيار الوقت المناسب أدناه.",
    action: "اختر وقت المكالمة",
    confirmationNote: "عند حجز الموعد، يصلك التأكيد في رسالة منفصلة من Cal.com.",
    noBook: "سنتواصل معك لتحديد وقت مكالمة تعريفية مدتها 30 دقيقة.",
    questions: (email: string) => `لديك سؤال؟ ردّ على هذه الرسالة أو راسلنا على ${email}.`,
    signoff: "فريق Mintapp",
    why: "وصلتك هذه الرسالة لأنك أرسلت طلب مشروع عبر mintapp.tech.",
    privacy: "سياسة الخصوصية",
    textLink: "اختر وقت المكالمة:",
  },
} as const;

// This email goes to whatever address was typed into the form, which is not
// necessarily the sender's own. So the visitor's free text is echoed only when
// it looks like a plain name: short, with no link, address or markup characters.
// Anything else gets a plain greeting.
export function greetingName(name: string | undefined): string | null {
  const trimmed = (name ?? "").trim();
  if (!trimmed || trimmed.length > 60) return null;
  if (/[@:/\x5c<>{}[\]|]|www\.|\.[a-z]{2,}|https?/i.test(trimmed)) return null;
  return trimmed;
}

// Latin names and addresses inside Arabic sentences are isolated so their
// punctuation stays in the right place.
const isolate = (html: string) => `<bdi>${html}</bdi>`;

export function buildClientAcknowledgment({ lang, name, bookingUrl, siteUrl = SITE_URL }: ClientAcknowledgmentInput): RenderedEmail {
  const t = CLIENT_ACK_COPY[lang];
  const privacyUrl = `${SITE_URL}/${lang}/privacy`;
  const contact = `<a href="mailto:${CONTACT_EMAIL}" style="color:${EMAIL_COLORS.mintDeep};text-decoration:underline;">${isolate(CONTACT_EMAIL)}</a>`;

  // The fixed copy has no HTML-special characters (asserted in the tests), so
  // only the visitor's name needs escaping before it is placed in a sentence.
  const greeting = greetingName(name);
  const content = [
    heading(lang, t.heading),
    paragraph(lang, greeting ? t.hello(isolate(escapeHtml(greeting))) : t.helloPlain),
    paragraph(lang, escapeHtml(t.received)),
    paragraph(lang, escapeHtml(t.review)),
    ...(bookingUrl
      ? [paragraph(lang, escapeHtml(t.bookIf), { spaceAfter: 8 }), button(lang, bookingUrl, t.action), paragraph(lang, escapeHtml(t.confirmationNote), { muted: true })]
      : [paragraph(lang, `<strong>${escapeHtml(t.noBook)}</strong>`)]),
    paragraph(lang, t.questions(contact)),
    paragraph(lang, escapeHtml(t.signoff), { spaceAfter: 0 }),
  ].join("\n");

  const html = renderLayout({
    lang,
    title: t.subject,
    preheader: bookingUrl ? t.preheaderBook : t.preheaderNoBook,
    content,
    footer: [
      escapeHtml(t.why),
      [link(SITE_URL, "mintapp.tech"), contact, link(privacyUrl, t.privacy)].join(" &nbsp;·&nbsp; "),
    ],
    siteUrl,
  });

  // The plain-text version says the same things in the same order.
  const text = [
    greeting ? t.hello(greeting) : t.helloPlain,
    "",
    t.received,
    "",
    t.review,
    "",
    ...(bookingUrl ? [t.bookIf, "", `${t.textLink} ${bookingUrl}`, "", t.confirmationNote] : [t.noBook]),
    "",
    t.questions(CONTACT_EMAIL),
    "",
    t.signoff,
    "",
    "--",
    t.why,
    `${SITE_URL}  |  ${CONTACT_EMAIL}  |  ${t.privacy}: ${privacyUrl}`,
  ].join("\n");

  return { subject: t.subject, html, text };
}

// A Cal.com link name looks like "mintapp/mintapp-discovery-call". The calendar
// counts as configured only when it does.
export const isValidCalLink = (calLink: string | undefined): calLink is string => Boolean(calLink && /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)+$/.test(calLink));

// The link behind the "Choose a call time" button: our own booking page, with the
// signed inquiry reference. It deliberately does NOT point at Cal.com directly:
// the page checks, on the server, whether the inquiry is already booked, was
// cancelled, or the reference is no longer valid (30 days), and only then offers
// a scheduler, so a booking started from an email can never be unlinked from its
// inquiry or duplicate an existing one.
export function recoveryUrlFor(lang: EmailLang, bookingContext: string | undefined, siteUrl = SITE_URL): string | undefined {
  if (!bookingContext || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(bookingContext)) return undefined;
  return `${siteUrl}/${lang}/book?ref=${encodeURIComponent(bookingContext)}`;
}
