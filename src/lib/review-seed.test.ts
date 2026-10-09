import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseSeedRows } from "../../scripts/lib/review-seed.mjs";

// The synthetic review inquiries once reached the review database as mojibake
// (UTF-8 bytes read as Windows code page 437), because the SQL was copied
// through `git show ... | clip`. The seed is now ASCII-only escapes; these
// tests fail if its Arabic is wrong, if non-ASCII text creeps back in, or if
// the setup guide recommends the unsafe route again.

type Row = Record<string, string | boolean | null>;
const rows = parseSeedRows() as Row[];
const expected = JSON.parse(readFileSync(join(process.cwd(), "tests", "fixtures", "review-seed-ar.json"), "utf8")).rows as Record<string, Record<string, string>>;

const isArabicLetter = (c: string) => c >= "؀" && c <= "ۿ";
// Box drawing, block and Latin-1/Latin Extended letters are what code page
// mix-ups produce from Arabic; the replacement character is a failed decode.
const MOJIBAKE = /[─-▟À-ÿ�]/;

describe("synthetic review seed", () => {
  test("every review SQL file is ASCII-only, so no code page can re-encode it", () => {
    const dir = join(process.cwd(), "supabase", "review");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
      const bytes = readFileSync(join(dir, file));
      expect(bytes.every((b) => b < 0x80), `${file} contains non-ASCII bytes`).toBe(true);
    }
  });

  test("the Arabic inquiries decode to exactly the expected words", () => {
    const arabic = rows.filter((r) => r.preferred_language === "ar");
    expect(arabic.map((r) => r.id)).toEqual(Object.keys(expected));
    for (const row of arabic) {
      for (const [column, text] of Object.entries(expected[row.id as string])) expect(row[column], `${row.id} ${column}`).toBe(text);
    }
  });

  test("no text shows the signs of mojibake, and each inquiry is in the language it claims", () => {
    for (const row of rows) {
      for (const [column, value] of Object.entries(row)) {
        if (typeof value !== "string") continue;
        expect(MOJIBAKE.test(value), `${row.id} ${column} looks corrupted`).toBe(false);
      }
      const letters = [...String(row.project_description)].filter((c) => /\p{L}/u.test(c));
      const share = letters.filter(isArabicLetter).length / letters.length;
      if (row.preferred_language === "ar") expect(share, `${row.id} brief should be Arabic`).toBeGreaterThan(0.8);
      else expect(share, `${row.id} brief should have no Arabic`).toBe(0);
    }
  });

  test("the seed can be re-run to repair rows: a conflict updates the content columns", () => {
    const sql = readFileSync(join(process.cwd(), "supabase", "review", "02_synthetic_inquiries.sql"), "utf8");
    expect(sql).toMatch(/on conflict \(id\) do update set/);
    for (const column of ["full_name", "preferred_language", "project_type", "country", "project_description"]) expect(sql).toContain(`${column} = excluded.${column}`);
  });

  test("only the four synthetic ids and example.com addresses appear", () => {
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.id).toMatch(/^11111111-0000-4000-8000-0000000000\d\d$/);
      expect(row.email).toMatch(/@example\.com$/);
    }
  });
});

describe("review setup guide", () => {
  const guide = readFileSync(join(process.cwd(), "docs", "admin-review-preview.md"), "utf8");

  test("never recommends piping SQL through the Windows clipboard; it may only warn against it", () => {
    // The warning can wrap across lines, so check each paragraph, not each line.
    for (const paragraph of guide.split(/\n\s*\n/).filter((p) => /\|\s*clip\b/.test(p))) {
      expect(paragraph, "a mention of '| clip' must be a warning").toMatch(/do not|never/i);
    }
  });

  test("tells the reader how to apply Unicode-sensitive SQL safely", () => {
    expect(guide).toContain("npm run review:seed");
    expect(guide).toMatch(/ASCII/);
  });
});
