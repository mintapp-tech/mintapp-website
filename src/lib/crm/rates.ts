// Conversion rates for the metrics page. A rate is shown only when its
// denominator is more than zero: "0 of 0" is "no data yet", not 0 %.

export interface Rate {
  numerator: number;
  denominator: number;
  percent: number | null;
}

export const rate = (numerator: number, denominator: number): Rate => ({
  numerator,
  denominator,
  percent: denominator > 0 ? Math.round((numerator / denominator) * 100) : null,
});

export interface CohortCounts {
  inquiries: number;
  booked: number;
  meeting_ready: number;
  discovery_complete: number;
  proposal_made: number;
  proposal_sent: number;
  won: number;
}

// The funnel the playbook asks for (section 15): inquiry to booking, booking
// to discovery complete, discovery to proposal, proposal to win, and the
// share of booked meetings that have approved preparation.
export function funnelRates(c: CohortCounts) {
  return {
    ready: rate(c.meeting_ready, c.booked),
    booking: rate(c.booked, c.inquiries),
    discovery: rate(c.discovery_complete, c.booked),
    proposal: rate(c.proposal_made, c.discovery_complete),
    win: rate(c.won, c.proposal_sent || c.proposal_made),
  };
}

// First and last day of the default window: the last 30 days up to today.
export function defaultRange(today: string, days = 30): { from: string; to: string } {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return { from: d.toISOString().slice(0, 10), to: today };
}
