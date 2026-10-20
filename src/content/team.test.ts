import { describe, expect, test } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { TEAM } from "./team";

describe("team", () => {
  test("Adam and Omar, each with a photo on disk and copy in both languages", () => {
    expect(TEAM.map((m) => m.name)).toEqual(["Abdelrahman (Adam) Eba", "Omar Abdelaziz"]);
    for (const m of TEAM) {
      expect(existsSync(join(process.cwd(), "public", m.photo)), m.id).toBe(true);
      for (const lang of ["en", "ar"] as const) {
        expect(m.role[lang].trim(), `${m.id} role ${lang}`).not.toBe("");
        expect(m.bio[lang].trim(), `${m.id} bio ${lang}`).not.toBe("");
      }
    }
  });
});
