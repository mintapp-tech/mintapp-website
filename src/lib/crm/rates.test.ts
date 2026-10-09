import { describe, expect, test } from "vitest";
import { defaultRange, funnelRates, rate } from "./rates";

describe("conversion rates", () => {
  test("a rate with nothing to divide by is no data, never 0 percent", () => {
    expect(rate(0, 0)).toEqual({ numerator: 0, denominator: 0, percent: null });
    expect(rate(3, 0).percent).toBeNull();
    expect(rate(1, 3).percent).toBe(33);
    expect(rate(2, 3).percent).toBe(67);
    expect(rate(5, 5).percent).toBe(100);
  });
  test("the funnel follows the playbook's measures", () => {
    const r = funnelRates({ inquiries: 10, booked: 6, meeting_ready: 3, discovery_complete: 4, proposal_made: 2, proposal_sent: 2, won: 1 });
    expect(r.booking.percent).toBe(60);
    expect(r.ready).toMatchObject({ numerator: 3, denominator: 6, percent: 50 });
    expect(r.discovery.percent).toBe(67);
    expect(r.proposal.percent).toBe(50);
    expect(r.win.percent).toBe(50);
  });
  test("an empty period shows no data throughout", () => {
    const r = funnelRates({ inquiries: 0, booked: 0, meeting_ready: 0, discovery_complete: 0, proposal_made: 0, proposal_sent: 0, won: 0 });
    expect(Object.values(r).every((x) => x.percent === null)).toBe(true);
  });
  test("the default window is the last 30 days including today", () => {
    expect(defaultRange("2026-10-09")).toEqual({ from: "2026-09-10", to: "2026-10-09" });
    expect(defaultRange("2026-03-01", 7)).toEqual({ from: "2026-02-23", to: "2026-03-01" });
  });
});
