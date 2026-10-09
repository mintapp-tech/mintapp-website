import { describe, expect, test } from "vitest";
import { addBusinessDays, nextTouchWindow } from "./cadence";

describe("outreach cadence", () => {
  test("business days skip Friday and Saturday", () => {
    // 2026-10-08 is a Thursday.
    expect(addBusinessDays("2026-10-08", 1)).toBe("2026-10-11"); // Sunday
    expect(addBusinessDays("2026-10-08", 3)).toBe("2026-10-13"); // Tuesday
    expect(addBusinessDays("2026-10-11", 5)).toBe("2026-10-18"); // Sunday + 5 = the next Sunday
    expect(addBusinessDays("2026-10-09", 0)).toBe("2026-10-09");
  });
  test("the windows are 3 to 4, 5 to 7 and 7 to 10 business days; there is nothing after touch 4", () => {
    expect(nextTouchWindow(1, "2026-10-11")).toEqual({ touch: 2, earliest: "2026-10-14", latest: "2026-10-15" });
    expect(nextTouchWindow(2, "2026-10-11")).toEqual({ touch: 3, earliest: "2026-10-18", latest: "2026-10-20" });
    expect(nextTouchWindow(3, "2026-10-11")).toEqual({ touch: 4, earliest: "2026-10-20", latest: "2026-10-25" });
    expect(nextTouchWindow(4, "2026-10-11")).toBeNull();
    expect(nextTouchWindow(0, "2026-10-11")).toBeNull();
  });
});
