import { CONTACT_EMAIL, EMAIL_COLORS, SITE_URL, button, escapeHtml, heading, link, paragraph, renderLayout, type EmailLang, type RenderedEmail } from "./layout";

// Sent to the client right after an accepted Start Project inquiry.
// Confirms receipt and points to the booking step. Deliberately promises no
// proposal, design or estimate (the site says none comes before the call).

export interface ClientAcknowledgmentInput {
  lang: EmailLang;
  /** Used in the greeting only when it looks like a plain name; see greetingName(). */
  name?: string;
  /** Booking page carrying the signed inquiry reference; absent when signing failed. */
  bookingUrl?: string;
  siteUrl?: string;
}

export const CLIENT_ACK_COPY = {
  en: {
    subject: "We received your project inquiry",
    preheaderBook: "Next step: choose a time for your 30-minute discovery call.",
    preheaderNoBook: "We will contact you to arrange your discovery call.",
    heading: "We have your idea",
    hello: (name: string) => `Hi ${name},`,
    helloPlain: "Hello,",
    received: "Thank you for telling us about your idea. Your inquiry has reached the Mintapp team.",
    review: "Before we meet, we read what you sent, so the call can focus on your goals and questions.",
    book: "Next step: choose a time for a 30-minute discovery call.",
    action: "Choose a call time",
    alreadyBooked: "Already picked a time after sending? Then you are all set. Cal.com sends your booking confirmation separately.",
    noBook: "We will contact you to arrange a time for a 30-minute discovery call.",
    questions: (email: string) => `Questions? Reply to this email or write to ${email}.`,
    signoff: "The Mintapp team",
    why: "You received this email because you sent a project inquiry on mintapp.tech.",
    privacy: "Privacy policy",
    textLink: "Choose a call time:",
  },
  ar: {
    subject: "وصلنا طلب مشروعك",
    preheaderBook: "الخطوة التالية: اختر وقتًا لمكالمتك التعريفية.",
    preheaderNoBook: "سنتواصل معك لتحديد موعد مكالمتك التعريفية.",
    heading: "وصلتنا فكرتك",
    hello: (name: string) => `مرحبًا ${name}،`,
    helloPlain: "مرحبًا،",
    received: "شكرًا لمشاركتنا فكرتك. وصل طلبك إلى فريق Mintapp.",
    review: "قبل أن نلتقي، نقرأ ما أرسلته حتى تركّز المكالمة على أهدافك وأسئلتك.",
    book: "الخطوة التالية: اختر وقتًا لمكالمة تعريفية مدتها 30 دقيقة.",
    action: "اختر وقت المكالمة",
    alreadyBooked: "إذا اخترت موعدًا بالفعل بعد الإرسال، فلا حاجة لأي خطوة أخرى. يصلك تأكيد الحجز في رسالة منفصلة من Cal.com.",
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
      ? [paragraph(lang, `<strong>${escapeHtml(t.book)}</strong>`, { spaceAfter: 8 }), button(lang, bookingUrl, t.action), paragraph(lang, escapeHtml(t.alreadyBooked), { muted: true })]
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

  const text = [
    greeting ? t.hello(greeting) : t.helloPlain,
    "",
    t.received,
    "",
    t.review,
    "",
    ...(bookingUrl ? [t.book, "", `${t.textLink} ${bookingUrl}`, "", t.alreadyBooked] : [t.noBook]),
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

// The booking page with the signed inquiry reference attached, using Cal.com's
// documented `metadata[key]` booking-link parameter (the same reference the
// on-page embed passes). The reference is valid for 7 days.
export function bookingUrlFor(calLink: string | undefined, bookingContext: string | undefined): string | undefined {
  if (!calLink || !bookingContext || !/^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)+$/.test(calLink)) return undefined;
  return `https://cal.com/${calLink}?metadata%5BbookingContext%5D=${encodeURIComponent(bookingContext)}`;
}
