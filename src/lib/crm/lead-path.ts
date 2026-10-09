// Where a lead's pages live. Each tab is its own address, so an action can send
// the browser back to the tab it came from (a server-built path, never input).

export const LEAD_TABS = ["overview", "pack", "deal", "activity"] as const;
export type LeadTab = (typeof LEAD_TABS)[number];

export const leadPath = (inquiryId: string, tab: LeadTab = "overview") => (tab === "overview" ? `/leads/${inquiryId}` : `/leads/${inquiryId}/${tab}`);
export const designPath = (inquiryId: string, version: number) => `/leads/${inquiryId}/pack/design?v=${version}`;
