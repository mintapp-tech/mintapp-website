// Reads the synthetic review seed (supabase/review/02_synthetic_inquiries.sql)
// into plain objects, so the repair script and the tests use the very text the
// database receives. The seed is ASCII-only SQL: Arabic is written as Postgres
// Unicode escapes, U&'...' with backslash-hex codes. This decodes exactly
// those, so a wrong or mangled escape shows up as wrong text.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export const SEED_PATH = join(process.cwd(), "supabase", "review", "02_synthetic_inquiries.sql");

// "\0645" is one character, "\+01F600" one outside the Basic Multilingual
// Plane, "\\" a backslash; "''" is a quote.
function decodeLiteral(body, unicodeEscapes) {
  let out = body.replaceAll("''", "'");
  if (unicodeEscapes) {
    out = out.replace(/\\(\\|\+[0-9A-Fa-f]{6}|[0-9A-Fa-f]{4})/g, (_m, code) => (code === "\\" ? "\\" : String.fromCodePoint(parseInt(code.replace("+", ""), 16))));
  }
  return out;
}

// Splits the VALUES section into tuples of decoded values: strings, null,
// true/false, and now() (kept as the text "now()"). Comments are skipped.
function tokenize(values) {
  const tuples = [];
  let current = null;
  let i = 0;
  while (i < values.length) {
    const rest = values.slice(i);
    let m;
    if ((m = /^\s+/.exec(rest)) || (m = /^--[^\n]*/.exec(rest))) i += m[0].length;
    else if (rest[0] === "(") (current = []), i++;
    else if (rest[0] === ")") tuples.push(current), (current = null), i++;
    else if (rest[0] === ",") i++;
    else if ((m = /^(U&)?'((?:[^']|'')*)'/.exec(rest))) (current.push(decodeLiteral(m[2], Boolean(m[1]))), (i += m[0].length));
    else if ((m = /^(null|true|false|now\(\))/i.exec(rest))) (current.push(m[1].toLowerCase() === "null" ? null : m[1].toLowerCase() === "true" ? true : m[1].toLowerCase() === "false" ? false : "now()"), (i += m[0].length));
    else throw new Error(`Seed parse error near: ${rest.slice(0, 30)}`);
  }
  return tuples;
}

export function parseSeedRows(sql = readFileSync(SEED_PATH, "utf8")) {
  const insert = /insert into public\.project_inquiries\s*\(([^)]*)\)\s*values([\s\S]*?)\non conflict/i.exec(sql);
  if (!insert) throw new Error("Seed has no insert ... values ... on conflict statement.");
  const columns = insert[1].split(",").map((c) => c.trim());
  return tokenize(insert[2]).map((values) => {
    if (values.length !== columns.length) throw new Error(`Seed row has ${values.length} values for ${columns.length} columns.`);
    return Object.fromEntries(columns.map((c, n) => [c, values[n]]));
  });
}
