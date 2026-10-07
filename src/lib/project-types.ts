// The Start Project form's "project type" question. The stored values are
// stable identifiers; the words people see live in the i18n files and in the
// email templates.
//
// Only an explicit choice on the form is ever stored as project_type. Nothing
// infers it from the written brief, and a future suggestion made by software or
// by the team belongs in its own column, never in this one, so the dashboard
// can always tell what the client said from what we think.
export const PROJECT_TYPES = ["website", "web_app", "mobile_app", "not_sure"] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

export const isProjectType = (value: unknown): value is ProjectType => typeof value === "string" && (PROJECT_TYPES as readonly string[]).includes(value);

// English wording for internal emails (the team reads these in English).
export const PROJECT_TYPE_LABELS_EN: Record<ProjectType, string> = {
  website: "Website",
  web_app: "Web application",
  mobile_app: "Mobile application",
  not_sure: "Not sure yet",
};
