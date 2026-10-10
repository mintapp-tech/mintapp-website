import { describe, expect, test } from "vitest";
import { EMAIL_COLORS as C, escapeHtml } from "./layout";
import { CLIENT_ACK_COPY, buildClientAcknowledgment, greetingName, isValidCalLink, recoveryUrlFor } from "./client-acknowledgment";
import { INQUIRY_NOTIFICATION_SUBJECT, buildInquiryNotificationEmail } from "./inquiry-notification-email";

const REFERENCE = "payload_part-1.signature_part-2";
const BOOKING_EN = recoveryUrlFor("en", REFERENCE);
const BOOKING_AR = recoveryUrlFor("ar", REFERENCE);
const HOSTILE = `Sara <script>alert(1)</script> "O'Neil" & Co`;

// Normal: a booking link exists. Fallback: none could be made (technical only).
const ackEn = buildClientAcknowledgment({ lang: "en", name: "Sara Haddad", bookingUrl: BOOKING_EN });
const ackAr = buildClientAcknowledgment({ lang: "ar", name: "سارة حداد", bookingUrl: BOOKING_AR });
const fallback = (lang: "en" | "ar") => buildClientAcknowledgment({ lang, name: "Sara" });
const internal = (over: Partial<Parameters<typeof buildInquiryNotificationEmail>[0]> = {}) =>
  buildInquiryNotificationEmail({
    inquiryId: "11111111-2222-4333-8444-555555555555",
    name: "Sara Haddad",
    email: "sara@example.com",
    lang: "en",
    desc: "A booking app.",
    submittedAt: new Date("2026-10-05T13:04:00Z"),
    ...over,
  });
const all = () => [ackEn, ackAr, fallback("en"), fallback("ar"), internal(), internal({ lang: "ar", desc: "تطبيق حجز", phone: "+974 5555 0100", company: "X" })];

describe("client acknowledgment: the normal email", () => {
  test("says, in the approved words, that the client can choose a time if they have not already", () => {
    expect(CLIENT_ACK_COPY.en.bookIf).toBe("If you haven’t already chosen a time, you can select one below.");
    expect(CLIENT_ACK_COPY.ar.bookIf).toBe("إذا لم تكن قد اخترت موعدًا بعد، يمكنك اختيار الوقت المناسب أدناه.");
    for (const [email, copy] of [[ackEn, CLIENT_ACK_COPY.en], [ackAr, CLIENT_ACK_COPY.ar]] as const) {
      expect(email.html).toContain(copy.bookIf);
      expect(email.text).toContain(copy.bookIf);
    }
  });

  test("the button keeps its label, in both languages", () => {
    expect(ackEn.html).toContain(">Choose a call time</a>");
    expect(ackAr.html).toContain(">اختر وقت المكالمة</a>");
  });

  test("never says the client must book twice, and never says Mintapp arranges every meeting", () => {
    const en = `${ackEn.html}\n${ackEn.text}`;
    const ar = `${ackAr.html}\n${ackAr.text}`;
    expect(en).not.toMatch(/must|need to book|book again|second|arrange|we will contact|we contact|reach out|already picked|all set/i);
    expect(ar).not.toMatch(/يجب|مرة أخرى|مرتين|سنتواصل معك|نتواصل معك|نرتب|لا حاجة/);
  });

  test("one clear action: a single link to our own booking page, never straight to Cal.com", () => {
    for (const [email, lang] of [[ackEn, "en"], [ackAr, "ar"]] as const) {
      expect(email.html.match(/<a href="https:\/\/www\.mintapp\.tech\/(en|ar)\/book\?ref=/g)).toHaveLength(1);
      expect(email.html).toContain(`href="https://www.mintapp.tech/${lang}/book?ref=${REFERENCE}"`);
      expect(email.text).toContain(`https://www.mintapp.tech/${lang}/book?ref=${REFERENCE}`);
      expect(`${email.html}\n${email.text}`).not.toMatch(/cal\.com\/(?!$)[A-Za-z]/); // only the words "Cal.com" in the note
      expect(email.html).not.toMatch(/href="https:\/\/cal\.com/);
    }
  });

  test("mentions that Cal.com sends the booking confirmation separately", () => {
    expect(ackEn.text).toContain(CLIENT_ACK_COPY.en.confirmationNote);
    expect(ackAr.text).toContain(CLIENT_ACK_COPY.ar.confirmationNote);
  });

  test("the HTML and the plain text carry the same sentences", () => {
    for (const [email, t] of [[ackEn, CLIENT_ACK_COPY.en], [ackAr, CLIENT_ACK_COPY.ar]] as const) {
      for (const sentence of [t.received, t.review, t.bookIf, t.confirmationNote, t.signoff, t.why]) {
        expect(email.text, sentence).toContain(sentence);
        expect(email.html, sentence).toContain(escapeHtml(sentence));
      }
    }
  });
});

describe("client acknowledgment: the technical fallback", () => {
  test("has no button and no booking link at all, and says Mintapp will contact the client", () => {
    for (const [lang, t] of [["en", CLIENT_ACK_COPY.en], ["ar", CLIENT_ACK_COPY.ar]] as const) {
      const e = fallback(lang);
      expect(e.html).not.toMatch(/href="https:\/\/(www\.mintapp\.tech\/(en|ar)\/book|cal\.com)/);
      expect(e.html).not.toContain(t.action);
      expect(e.text).not.toMatch(/\/book|cal\.com/i); // the footer's site and privacy addresses are fine; a booking link is not
      expect(e.text).toContain(t.noBook);
      expect(e.text).toContain(t.received); // the inquiry was received
      expect(e.text).not.toContain(t.bookIf);
    }
  });

  test("the HTML and the plain text carry the same sentences", () => {
    for (const [email, t] of [[fallback("en"), CLIENT_ACK_COPY.en], [fallback("ar"), CLIENT_ACK_COPY.ar]] as const) {
      for (const sentence of [t.received, t.review, t.noBook, t.signoff]) {
        expect(email.text, sentence).toContain(sentence);
        expect(email.html, sentence).toContain(escapeHtml(sentence));
      }
    }
  });

  test("is chosen by whether a booking link exists, and by nothing else", () => {
    // Same client, same everything: only the link differs.
    expect(buildClientAcknowledgment({ lang: "en", name: "Sara", bookingUrl: BOOKING_EN }).text).toContain(CLIENT_ACK_COPY.en.bookIf);
    expect(buildClientAcknowledgment({ lang: "en", name: "Sara", bookingUrl: undefined }).text).toContain(CLIENT_ACK_COPY.en.noBook);
  });
});

describe("client acknowledgment: subject, direction, greeting and safety", () => {
  test("subjects are fixed and carry no inquiry details", () => {
    expect(ackEn.subject).toBe("We received your project inquiry");
    expect(ackAr.subject).toBe("وصلنا طلب مشروعك");
    expect(buildClientAcknowledgment({ lang: "en", name: HOSTILE, bookingUrl: BOOKING_EN }).subject).toBe(ackEn.subject);
  });

  test("English is left to right and Arabic is right to left, end to end", () => {
    expect(ackEn.html).toContain('<html lang="en" dir="ltr">');
    expect(ackAr.html).toContain('<html lang="ar" dir="rtl">');
    expect(ackAr.html).toContain('dir="rtl" bgcolor');
    expect(ackAr.html).toMatch(/text-align:right/);
    expect(ackAr.html).not.toMatch(/text-align:left/);
    // The Latin wordmark stays left to right inside the Arabic header.
    expect(ackAr.html).toContain('<span dir="ltr"');
  });

  test("a plain name is escaped in HTML and kept as typed in plain text", () => {
    const e = buildClientAcknowledgment({ lang: "en", name: "Sara O'Neil & Co", bookingUrl: BOOKING_EN });
    expect(e.html).toContain("Sara O&#39;Neil &amp; Co");
    expect(e.text).toContain("Hi Sara O'Neil & Co,");
  });

  test("the email goes to whatever address was typed, so free text that is not a plain name is never echoed", () => {
    for (const name of [HOSTILE, "Click http://evil.example now", "www.evil.example", "a@b.co", "evil.example", "x" + String.fromCharCode(92) + "y", "N".repeat(61)]) {
      const e = buildClientAcknowledgment({ lang: "en", name, bookingUrl: BOOKING_EN });
      expect(e.html, name).not.toContain("<script>");
      expect(e.html, name).not.toContain("evil");
      expect(e.text, name).not.toContain("evil");
      expect(e.text, name).toMatch(/^Hello,/);
    }
    expect(buildClientAcknowledgment({ lang: "ar", name: "http://x.example" }).text).toMatch(/^مرحبًا،/);
    expect(buildClientAcknowledgment({ lang: "en" }).text).toMatch(/^Hello,/);
  });

  test("greetingName keeps ordinary names, in either script", () => {
    for (const name of ["Sara Haddad", "Ahmed M. Ali", "Mary-Anne O'Neil", "سارة حداد"]) expect(greetingName(name)).toBe(name);
    expect(greetingName("   ")).toBeNull();
    expect(greetingName(undefined)).toBeNull();
  });

  test("fixed copy has no HTML-special characters, so it is safe to place unescaped", () => {
    const strings = Object.values(CLIENT_ACK_COPY).flatMap((t) => Object.values(t).map((v) => (typeof v === "function" ? v("") : v)));
    for (const s of strings) expect(s).not.toMatch(/[<>&"']/);
  });

  test("promises no proposal, design, estimate or pricing", () => {
    expect(`${ackEn.text}\n${fallback("en").text}`).not.toMatch(/proposal|estimate|pric|quote|design|mockup/i);
    expect(`${ackAr.text}\n${fallback("ar").text}`).not.toMatch(/عرض|تسعير|تقدير|تكلفة|تصميم/);
  });

  test("footer has the contact address, website and the privacy policy in the email's language", () => {
    expect(ackEn.html).toContain('href="mailto:hello@mintapp.tech"');
    expect(ackEn.html).toContain('href="https://www.mintapp.tech/en/privacy"');
    expect(ackAr.html).toContain('href="https://www.mintapp.tech/ar/privacy"');
    expect(ackAr.html).toContain(">سياسة الخصوصية</a>");
  });
});

describe("the booking link", () => {
  test("points to our own page, in the email's language, with the reference as a URL-safe query", () => {
    expect(recoveryUrlFor("en", REFERENCE)).toBe(`https://www.mintapp.tech/en/book?ref=${REFERENCE}`);
    expect(recoveryUrlFor("ar", REFERENCE)).toBe(`https://www.mintapp.tech/ar/book?ref=${REFERENCE}`);
    expect(recoveryUrlFor("en", REFERENCE, "https://preview.example")).toBe(`https://preview.example/en/book?ref=${REFERENCE}`);
  });

  test("is made only from a well-formed signed reference", () => {
    for (const bad of [undefined, "", "no-dot", "a.b.c", "a b.c", "a.b?x=1", "a.b#frag", "<script>.x", "a.b\n"]) expect(recoveryUrlFor("en", bad), String(bad)).toBeUndefined();
  });

  test("a calendar counts as configured only when its link looks like one", () => {
    expect(isValidCalLink("mintapp/mintapp-discovery-call")).toBe(true);
    for (const bad of [undefined, "", "mintapp", "https://evil.example/x", "mintapp/../x y", "mintapp/call?x=1"]) expect(isValidCalLink(bad), String(bad)).toBe(false);
  });
});

describe("internal notification", () => {
  test("keeps the fixed generic subject", () => {
    expect(internal({ name: HOSTILE, company: "Secret Co", desc: "Secret idea" }).subject).toBe(INQUIRY_NOTIFICATION_SUBJECT);
    expect(INQUIRY_NOTIFICATION_SUBJECT).toBe("New Mintapp project inquiry");
  });

  test("plain text keeps the current line format", () => {
    expect(internal({ phone: "+974 1", company: "Acme" }).text).toBe(
      [
        "Inquiry ID: 11111111-2222-4333-8444-555555555555",
        "Name: Sara Haddad",
        "Email: sara@example.com",
        "Phone: +974 1",
        "Company: Acme",
        "Project type: Not provided",
        "Budget: Not provided",
        "Timeline: Not provided",
        "Preferred language: English",
        "Submitted: 5 Oct 2026, 13:04 UTC",
        "",
        "Project description:",
        "A booking app.",
      ].join("\n"),
    );
    expect(internal().text).not.toMatch(/Phone:|Company:/);
  });

  test("shows the client's explicit project type in English, and 'Not provided' for anything else", () => {
    for (const [value, label] of [["website", "Website"], ["web_app", "Web application"], ["mobile_app", "Mobile application"], ["not_sure", "Not sure yet"]] as const) {
      const e = internal({ projectType: value });
      expect(e.text).toContain(`Project type: ${label}`);
      expect(e.html).toContain(">Project type</td>");
      expect(e.html).toContain(`>${label}</td>`);
    }
    // Missing (an older form), or a legacy database value the form never offered: never shown as the client's choice.
    for (const value of [undefined, null, "", "other", "website_and_mobile", "<b>x</b>"]) {
      const e = internal({ projectType: value });
      expect(e.text, String(value)).toContain("Project type: Not provided");
      expect(e.html, String(value)).not.toContain("<b>x</b>");
    }
  });

  test("shows the budget and timeline as English labels, never as stored codes, including an older cached form's values", () => {
    const e = internal({ budget: "5000_10000", timeline: "within_3_months" });
    expect(e.text).toContain("Budget: USD 5,000–10,000");
    expect(e.text).toContain("Timeline: Within 3 months");
    expect(e.html).toContain(">Budget</td>");
    expect(`${e.text} ${e.html}`).not.toMatch(/5000_10000|within_3_months/);
    const later = internal({ budget: "not_sure", timeline: "over_6_months" }).text;
    expect(later).toContain("Budget: Not sure yet");
    expect(later).toContain("Timeline: Later than 6 months");
    expect(internal({ budget: "USD 5,000 - 15,000" }).text).toContain("Budget: USD 5,000–15,000");
    expect(internal({ budget: "<b>x</b>" }).html).not.toContain("<b>x</b>");
  });

  test("every client-supplied field is escaped, and the description follows its own direction", () => {
    const e = internal({ name: HOSTILE, company: HOSTILE, phone: "<b>1</b>", desc: `<img src=x onerror=alert(1)>\nسطر` });
    expect(e.html).not.toMatch(/<script>|<img src=x|<b>1/);
    expect(e.html).toContain('<div dir="auto"');
  });
});

describe("every template", () => {
  test("no tracking pixels and no third-party resources: one image, our own mark, links only to our site and our address", () => {
    for (const e of all()) {
      const images = e.html.match(/<img\b[^>]*>/g) ?? [];
      expect(images).toHaveLength(1);
      expect(images[0]).toContain('src="https://www.mintapp.tech/email/mintapp-mark.png" width="36" height="36" alt=""');
      expect(e.html).not.toMatch(/<link\b|<script\b|@import|url\(|<iframe|<video|<audio/i);
      // The brand name is live text, so it survives blocked images.
      expect(e.html).toContain(">mintapp</span>");
      for (const [, href] of e.html.matchAll(/href="([^"]+)"/g)) {
        expect(href).toMatch(/^(https:\/\/www\.mintapp\.tech|mailto:)/);
      }
    }
  });

  test("a plain-text alternative without markup", () => {
    for (const e of all()) {
      expect(e.text.length).toBeGreaterThan(40);
      expect(e.text).not.toMatch(/<[a-z/]/i);
    }
  });

  test("no em dashes in the copy", () => {
    for (const e of all()) expect(`${e.subject}${e.html}${e.text}`).not.toContain(String.fromCharCode(0x2014));
  });

  // WCAG 2 relative luminance and contrast ratio.
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  test.each([
    ["body text on the card", C.ink, C.surface],
    ["secondary text on the card", C.inkSoft, C.surface],
    ["links on the card", C.mintDeep, C.surface],
    ["button label on the button", "#ffffff", C.mintDeep],
    ["footer text on the page", C.inkFaint, C.canvas],
    ["footer links on the page", C.mintDeep, C.canvas],
    ["description text on its panel", C.ink, C.canvas],
  ])("contrast meets WCAG AA: %s", (_name, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});
