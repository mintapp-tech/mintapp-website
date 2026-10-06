// What the dashboard may call the client's project type.
//
// The public Start Project form offers exactly four choices. Only one of those
// is "provided by the client". The column can also hold older values the form
// never offered (website_and_mobile, other, or whatever a hand edit or a demo
// seed left there), and those are NOT the client's answer: they show as
// "Not provided", never as "Other".
//
// A future suggestion made by software or by the team ("Suggested from the
// brief", editable by Omar or Adam) must live in its own column and be shown
// separately. Nothing here, and nothing in the form, infers a type from the brief.

export const CLIENT_PROJECT_TYPES = ["website", "web_app", "mobile_app", "not_sure"] as const;

export type ClientProjectType = (typeof CLIENT_PROJECT_TYPES)[number];

export const clientProjectType = (value: string | null | undefined): ClientProjectType | null =>
  (CLIENT_PROJECT_TYPES as readonly string[]).includes(value ?? "") ? (value as ClientProjectType) : null;

// The wording of the public form, so the team sees what the client saw.
export const PROJECT_TYPE_WORDS: Record<"en" | "ar", Record<ClientProjectType, string>> = {
  en: { website: "Website", web_app: "Web application", mobile_app: "Mobile application", not_sure: "Not sure yet" },
  ar: { website: "موقع إلكتروني", web_app: "تطبيق ويب", mobile_app: "تطبيق جوّال", not_sure: "لست متأكدًا بعد" },
};
