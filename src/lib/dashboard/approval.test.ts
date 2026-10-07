import { describe, expect, test } from "vitest";
import { isAuthor, mayApprove, needsApprovalBeforeMeeting } from "./approval";

const OMAR = "omar@mintapp.example";
const ADAM = "adam@mintapp.example";

describe("teammate approval", () => {
  const inReview = { created_by: OMAR, review_status: "in_review" };

  test("the person who wrote a version may not approve it, whatever the letter case or spacing", () => {
    expect(mayApprove(inReview, OMAR)).toBe(false);
    expect(mayApprove(inReview, "  OMAR@Mintapp.Example ")).toBe(false);
    expect(isAuthor(inReview, OMAR)).toBe(true);
  });

  test("the other teammate may approve a version that is ready for review", () => {
    expect(mayApprove(inReview, ADAM)).toBe(true);
    expect(isAuthor(inReview, ADAM)).toBe(false);
  });

  test("only a version marked ready can be approved, by anyone", () => {
    for (const review_status of ["draft", "approved", "superseded"]) {
      expect(mayApprove({ created_by: OMAR, review_status }, ADAM), review_status).toBe(false);
    }
  });

  test("a version made by automation has no human author, so either teammate may approve it", () => {
    const automated = { created_by: "automation", review_status: "in_review" };
    expect(mayApprove(automated, OMAR)).toBe(true);
    expect(mayApprove(automated, ADAM)).toBe(true);
  });

  test("an edit by the other teammate is a new version they wrote, so the first author may approve it", () => {
    expect(mayApprove({ created_by: ADAM, review_status: "in_review" }, OMAR)).toBe(true);
    expect(mayApprove({ created_by: ADAM, review_status: "in_review" }, ADAM)).toBe(false);
  });
});

describe("approval needed before the meeting", () => {
  const now = new Date("2026-10-08T10:00:00Z");
  const booked = { booking_status: "booked", meeting_start_at: "2026-10-12T09:00:00Z", approved_version: null };

  test("a booked upcoming meeting without an approved note is flagged", () => {
    expect(needsApprovalBeforeMeeting(booked, now)).toBe(true);
  });

  test("an approved note clears the flag, and a withdrawn approval brings it back", () => {
    expect(needsApprovalBeforeMeeting({ ...booked, approved_version: 2 }, now)).toBe(false);
    expect(needsApprovalBeforeMeeting({ ...booked, approved_version: null }, now)).toBe(true);
  });

  test("cancelled, completed, no-show and unbooked inquiries are not flagged", () => {
    for (const booking_status of ["cancelled", "completed", "no_show", "not_booked"]) {
      expect(needsApprovalBeforeMeeting({ ...booked, booking_status }, now), booking_status).toBe(false);
    }
  });

  test("a meeting that already started, or has no time, is not flagged", () => {
    expect(needsApprovalBeforeMeeting({ ...booked, meeting_start_at: "2026-10-08T09:59:59Z" }, now)).toBe(false);
    expect(needsApprovalBeforeMeeting({ ...booked, meeting_start_at: null }, now)).toBe(false);
  });

  test("a cancelled meeting that is rebooked is flagged again until a note is approved", () => {
    const rebooked = { booking_status: "booked", meeting_start_at: "2026-10-15T09:00:00Z", approved_version: null };
    expect(needsApprovalBeforeMeeting(rebooked, now)).toBe(true);
  });
});
