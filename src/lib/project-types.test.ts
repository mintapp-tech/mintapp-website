import { describe, expect, test } from "vitest";
import { PROJECT_TYPES, PROJECT_TYPE_LABELS_EN, isProjectType } from "./project-types";

describe("project types", () => {
  test("the four stored values are exactly the ones the product defined, in form order", () => {
    expect([...PROJECT_TYPES]).toEqual(["website", "web_app", "mobile_app", "not_sure"]);
  });

  test("every value has an English label for internal emails", () => {
    expect(PROJECT_TYPE_LABELS_EN).toEqual({ website: "Website", web_app: "Web application", mobile_app: "Mobile application", not_sure: "Not sure yet" });
  });

  test("isProjectType accepts only the four values", () => {
    for (const value of PROJECT_TYPES) expect(isProjectType(value)).toBe(true);
    for (const value of ["other", "website_and_mobile", "", null, undefined, 1]) expect(isProjectType(value)).toBe(false);
  });
});
