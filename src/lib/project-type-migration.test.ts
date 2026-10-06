import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("project_type migration", () => {
  const sql = readFileSync(join(process.cwd(), "supabase", "migrations", "20261004000000_allow_not_sure_project_type.sql"), "utf8");
  const code = sql.replace(/--[^\n]*/g, "");

  test("is additive: every earlier value stays allowed, null stays allowed, and not_sure is new", () => {
    for (const value of ["website", "web_app", "mobile_app", "website_and_mobile", "other", "not_sure"]) expect(code).toContain(`'${value}'`);
    expect(code).toContain("project_type is null or");
  });

  test("changes only this constraint: no data change, no column drop, no other table", () => {
    expect(code).not.toMatch(/\b(update|delete|insert|truncate|drop\s+(column|table)|create\s+table|alter\s+column)\b/i);
    expect(code.match(/alter table/gi)).toHaveLength(2);
    expect(code).not.toMatch(/\bnot valid\b/i);
  });

  test("is ASCII-only, so no code page can alter it when it is copied", () => {
    expect([...Buffer.from(sql)].every((b) => b < 0x80)).toBe(true);
  });
});
