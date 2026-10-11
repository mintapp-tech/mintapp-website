import { describe, expect, test } from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RULE_FILES } from "./rules";
import { clinicPack } from "./test-fixtures";

// The rules Claude reads (docs/pack-rules/) are generated from the code.
// UPDATE_PACK_RULES=1 (npm run pack:rules) rewrites them; otherwise this checks
// that the committed files are exactly what the code produces.
const dir = join(process.cwd(), "docs", "pack-rules");
const normal = (s: string) => s.replace(/\r\n/g, "\n");

describe("the generated Pack rules", () => {
  if (process.env.UPDATE_PACK_RULES === "1") {
    test("are written from the code", () => {
      mkdirSync(dir, { recursive: true });
      for (const [name, make] of Object.entries(RULE_FILES)) writeFileSync(join(dir, name), make());
    });
    return;
  }

  test.each(Object.keys(RULE_FILES))("%s is up to date with the code (run npm run pack:rules)", (name) => {
    expect(normal(readFileSync(join(dir, name), "utf8"))).toBe(normal(RULE_FILES[name]()));
  });

  test("the JSON Schema lists the library's ids and every section", () => {
    const schema = JSON.parse(RULE_FILES["pack.schema.json"]()) as { required: string[]; additionalProperties: boolean };
    expect(schema.required).toEqual(expect.arrayContaining(Object.keys(clinicPack())));
    expect(schema.additionalProperties).toBe(false);
    expect(RULE_FILES["pack.schema.json"]()).toContain('"mobile_transactions"');
  });
});
