import { describe, expect, test } from "vitest";
import { EMAIL_COLORS as C } from "./layout";
import { CLIENT_ACK_COPY, bookingUrlFor, buildClientAcknowledgment, greetingName } from "./client-acknowledgment";
import { INQUIRY_NOTIFICATION_SUBJECT, buildInquiryNotificationEmail } from "./inquiry-notification-email";

const BOOKING = bookingUrlFor("mintapp/mintapp-discovery-call", "ref+/=token");
const HOSTILE = `Sara <script>alert(1)</script> "O'Neil" & Co`;

const ackEn = buildClientAcknowledgment({ lang: "en", name: "Sara Haddad", bookingUrl: BOOKING });
const ackAr = buildClientAcknowledgment({ lang: "ar", name: "سارة حداد", bookingUrl: BOOKING });
const ackNoCal = (lang: "en" | "ar") => buildClientAcknowledgment({ lang, name: "Sara" });
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
const all = () => [ackEn, ackAr, ackNoCal("en"), ackNoCal("ar"), internal(), internal({ lang: "ar", desc: "تطبيق حجز", phone: "+974 5555 0100", company: "X" })];

describe("client acknowledgment", () => {
  test("subjects are fixed and carry no inquiry details", () => {
    expect(ackEn.subject).toBe("We received your project inquiry");
    expect(ackAr.subject).toBe("وصلنا طلب مشروعك");
    const hostile = buildClientAcknowledgment({ lang: "en", name: HOSTILE, bookingUrl: BOOKING });
    expect(hostile.subject).toBe(ackEn.subject);
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

  test("one clear action that names what it does, linked to the booking page", () => {
    for (const [email, label] of [[ackEn, "Choose a call time"], [ackAr, "اختر وقت المكالمة"]] as const) {
      expect(email.html.match(/<a href="https:\/\/cal\.com\//g)).toHaveLength(1);
      expect(email.html).toContain(`>${label}</a>`);
      expect(email.text).toContain(BOOKING);
    }
  });

  test("the booking link carries the signed reference, encoded", () => {
    expect(BOOKING).toBe("https://cal.com/mintapp/mintapp-discovery-call?metadata%5BbookingContext%5D=ref%2B%2F%3Dtoken");
  });

  test("without a booking link, it says we will arrange the time and links nowhere else", () => {
    expect(ackNoCal("en").html).not.toContain("cal.com/");
    expect(ackNoCal("en").text).toContain(CLIENT_ACK_COPY.en.noBook);
    expect(ackNoCal("ar").text).toContain(CLIENT_ACK_COPY.ar.noBook);
  });

  test("a plain name is escaped in HTML and kept as typed in plain text", () => {
    const e = buildClientAcknowledgment({ lang: "en", name: "Sara O'Neil & Co", bookingUrl: BOOKING });
    expect(e.html).toContain("Sara O&#39;Neil &amp; Co");
    expect(e.text).toContain("Hi Sara O'Neil & Co,");
  });

  test("the email goes to whatever address was typed, so free text that is not a plain name is never echoed", () => {
    for (const name of [HOSTILE, "Click http://evil.example now", "www.evil.example", "a@b.co", "evil.example", "x" + String.fromCharCode(92) + "y", "N".repeat(61)]) {
      const e = buildClientAcknowledgment({ lang: "en", name, bookingUrl: BOOKING });
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

  test("the booking link is built only from a well-formed Cal link and a reference", () => {
    expect(bookingUrlFor("mintapp/mintapp-discovery-call", "ref")).toBe("https://cal.com/mintapp/mintapp-discovery-call?metadata%5BbookingContext%5D=ref");
    for (const calLink of [undefined, "", "mintapp", "https://evil.example/x", "mintapp/../x y", "mintapp/call?x=1"]) expect(bookingUrlFor(calLink, "ref"), String(calLink)).toBeUndefined();
    expect(bookingUrlFor("mintapp/mintapp-discovery-call", undefined)).toBeUndefined();
  });

  test("fixed copy has no HTML-special characters, so it is safe to place unescaped", () => {
    const strings = Object.values(CLIENT_ACK_COPY).flatMap((t) =>
      Object.values(t).map((v) => (typeof v === "function" ? v("") : v)),
    );
    for (const s of strings) expect(s).not.toMatch(/[<>&"']/);
  });

  test("promises no proposal, design, estimate or pricing", () => {
    expect(`${ackEn.text}\n${ackNoCal("en").text}`).not.toMatch(/proposal|estimate|pric|quote|design|mockup/i);
    expect(`${ackAr.text}\n${ackNoCal("ar").text}`).not.toMatch(/عرض|تسعير|تقدير|تكلفة|تصميم/);
  });

  test("footer has the contact address, website and the privacy policy in the email's language", () => {
    expect(ackEn.html).toContain('href="mailto:hello@mintapp.tech"');
    expect(ackEn.html).toContain('href="https://www.mintapp.tech/en/privacy"');
    expect(ackAr.html).toContain('href="https://www.mintapp.tech/ar/privacy"');
    expect(ackAr.html).toContain(">سياسة الخصوصية</a>");
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

  test("every client-supplied field is escaped, and the description follows its own direction", () => {
    const e = internal({ name: HOSTILE, company: HOSTILE, phone: "<b>1</b>", desc: `<img src=x onerror=alert(1)>\nسطر` });
    expect(e.html).not.toMatch(/<script>|<img src=x|<b>1/);
    expect(e.html).toContain('<div dir="auto"');
  });
});

describe("every template", () => {
  test("no tracking pixels and no third-party resources: one image, our own mark", () => {
    for (const e of all()) {
      const images = e.html.match(/<img\b[^>]*>/g) ?? [];
      expect(images).toHaveLength(1);
      expect(images[0]).toContain('src="https://www.mintapp.tech/email/mintapp-mark.png" width="36" height="36" alt=""');
      expect(e.html).not.toMatch(/<link\b|<script\b|@import|url\(|<iframe|<video|<audio/i);
      // The brand name is live text, so it survives blocked images.
      expect(e.html).toContain(">mintapp</span>");
      for (const [, href] of e.html.matchAll(/href="([^"]+)"/g)) {
        expect(href).toMatch(/^(https:\/\/www\.mintapp\.tech|https:\/\/cal\.com\/mintapp\/|mailto:)/);
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
