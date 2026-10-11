import type { ProjectKind } from "./patterns";

// Proposal patterns: how Mintapp frames an indicative proposal direction for each
// kind of project, before discovery. They shape the "Draft scope and proposal
// direction" artifact; they never carry a price, a duration or a commitment (those
// belong to the final proposal, written after discovery, on the Deal tab).

export interface ProposalPattern {
  // The project kind it suits; null: any kind (an existing product).
  kind: ProjectKind | null;
  en: string;
  ar: string;
  fits: string;
  // Typical phases, as guidance; the Pack names its own.
  phases: string[];
  // What is usually delivered.
  deliverables: string[];
  // What usually moves cost and schedule (factors, never figures).
  factors: string[];
  // What a first release usually leaves out unless the client asks.
  usuallyExcluded: string[];
}

export const PROPOSAL_PATTERNS = {
  website: {
    kind: "website",
    en: "Website",
    ar: "موقع إلكتروني",
    fits: "a new or rebuilt website for a company, product, academy or booking business",
    phases: ["Content and structure", "Design", "Build and content entry", "Launch and handover"],
    deliverables: ["A site map and page structure", "Designs for each page type at desktop and phone width", "The built website in the agreed languages", "Handover of content editing"],
    factors: ["How many page types and languages", "Who writes and translates the content", "Forms, booking or payment on the site", "Integrations with existing tools"],
    usuallyExcluded: ["Copywriting and translation unless agreed", "Photography and brand identity", "Paid advertising"],
  },
  web_app: {
    kind: "web_app",
    en: "Web application",
    ar: "تطبيق ويب",
    fits: "a system people sign in to and work in: dashboards, workflows, scheduling, administration",
    phases: ["Discovery and flows", "Design of the main screens", "Build of the first release", "Testing with real users and launch"],
    deliverables: ["User flows for the main tasks", "Designs for the main screens", "The working first release", "Accounts and roles for the team"],
    factors: ["How many user roles and permissions", "Integrations and data to import", "Reporting needs", "Arabic and English throughout"],
    usuallyExcluded: ["Data clean-up of old systems", "Features for later releases", "Hardware and third-party subscriptions"],
  },
  mobile_app: {
    kind: "mobile_app",
    en: "Mobile application",
    ar: "تطبيق جوّال",
    fits: "an app for phones, with or without a web dashboard behind it",
    phases: ["Discovery and flows", "Design of the main screens", "Build and store preparation", "Testing and store release"],
    deliverables: ["User flows", "Designs for the main screens at phone size", "The app for the agreed platforms", "Store listings prepared with the client"],
    factors: ["Which platforms (iOS, Android, both)", "Payments and accounts", "Notifications and offline use", "The admin side behind the app"],
    usuallyExcluded: ["Store fees and developer accounts", "Marketing the app", "Hardware integrations unless agreed"],
  },
  existing_product: {
    kind: null,
    en: "Improving an existing product",
    ar: "تطوير منتج قائم",
    fits: "a website or app the client already runs that needs a redesign, new features or fixes",
    phases: ["Review of what exists", "Priorities agreed", "Design and build of the agreed changes", "Release and follow-up"],
    deliverables: ["A short review of the current product", "A prioritised list of changes", "Designs and the built changes", "Release notes"],
    factors: ["The state and ownership of the current code", "Access to hosting and data", "How much changes at once", "Keeping the current product running meanwhile"],
    usuallyExcluded: ["Rewriting what works", "Unrelated fixes found during the review unless agreed"],
  },
} as const satisfies Record<string, ProposalPattern>;

export type ProposalPatternId = keyof typeof PROPOSAL_PATTERNS;
export const PROPOSAL_PATTERN_IDS = Object.keys(PROPOSAL_PATTERNS) as ProposalPatternId[];
export const isProposalPatternId = (value: unknown): value is ProposalPatternId => typeof value === "string" && Object.hasOwn(PROPOSAL_PATTERNS, value);

export function proposalCatalogueText(): string {
  return PROPOSAL_PATTERN_IDS.map((id) => {
    const p = PROPOSAL_PATTERNS[id];
    return `- ${id}${p.kind ? ` (${p.kind})` : " (any kind)"}: ${p.fits}. Typical phases: ${p.phases.join("; ")}. Factors: ${p.factors.join("; ")}.`;
  }).join("\n");
}
