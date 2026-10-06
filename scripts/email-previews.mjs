// Writes local previews of every Mintapp email template to .email-previews/
// (git-ignored). Sends nothing and reads no environment variables.
//
//   npm run email:preview
//   then open .email-previews/index.html in a browser.
//
// Loads the TypeScript templates through Vite's module runner (Vite is already
// installed as part of Vitest). The sample people below are fictional and
// exist only in this script, never in the application.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { runnerImport } from "vite";

const root = process.cwd();
const out = join(root, ".email-previews");
// Previews load the mark from public/ instead of the live site.
const siteUrl = pathToFileURL(join(root, "public")).href;

const { module: ack } = await runnerImport(join(root, "src/lib/email/client-acknowledgment.ts"));
const { module: note } = await runnerImport(join(root, "src/lib/email/inquiry-notification-email.ts"));

const bookingUrl = ack.recoveryUrlFor("en", "preview-reference.signature", siteUrl);
const bookingUrlAr = ack.recoveryUrlFor("ar", "preview-reference.signature", siteUrl);
const previews = {
  "client-acknowledgment-en": ack.buildClientAcknowledgment({ lang: "en", name: "Sara Haddad", bookingUrl, siteUrl }),
  "client-acknowledgment-ar": ack.buildClientAcknowledgment({ lang: "ar", name: "سارة حداد", bookingUrl: bookingUrlAr, siteUrl }),
  "client-acknowledgment-en-fallback": ack.buildClientAcknowledgment({ lang: "en", name: "Sara Haddad", siteUrl }),
  "client-acknowledgment-ar-fallback": ack.buildClientAcknowledgment({ lang: "ar", name: "سارة حداد", siteUrl }),
  "client-acknowledgment-en-plain-greeting": ack.buildClientAcknowledgment({ lang: "en", name: "http://not-a-name.example", bookingUrl, siteUrl }),
  "internal-notification-en": note.buildInquiryNotificationEmail({
    inquiryId: "00000000-0000-4000-8000-000000000000",
    name: "Sara Haddad",
    email: "sara@example.com",
    phone: "+974 5555 0100",
    company: "Example Studio",
    projectType: "web_app",
    lang: "en",
    desc: "We want a booking app for a small chain of fitness studios.\nMembers should see classes, book a spot and get reminders.",
    submittedAt: new Date("2026-10-05T13:04:00Z"),
    siteUrl,
  }),
  "internal-notification-ar-description": note.buildInquiryNotificationEmail({
    inquiryId: "00000000-0000-4000-8000-000000000001",
    name: "سارة حداد",
    email: "sara@example.com",
    lang: "ar",
    desc: "نريد تطبيقًا لحجز الحصص في سلسلة صغيرة من النوادي الرياضية.\nيرى الأعضاء الحصص ويحجزون مكانًا ويصلهم تذكير.",
    submittedAt: new Date("2026-10-05T13:04:00Z"),
    siteUrl,
  }),
};

mkdirSync(out, { recursive: true });
const items = [];
for (const [name, email] of Object.entries(previews)) {
  writeFileSync(join(out, `${name}.html`), email.html);
  writeFileSync(join(out, `${name}.txt`), `Subject: ${email.subject}\n\n${email.text}\n`);
  items.push(`<li><a href="${name}.html">${name}</a> (<a href="${name}.txt">plain text</a>): ${email.subject.replace(/</g, "&lt;")}</li>`);
}
writeFileSync(
  join(out, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Mintapp email previews</title><body style="font-family:system-ui;margin:32px"><h1>Mintapp email previews</h1><ul>${items.join("")}</ul></body>`,
);
console.log(`Wrote ${items.length} previews to ${out}`);
