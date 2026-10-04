// A throwaway PostgreSQL cluster for database-level tests: created in a temp
// folder on a free localhost port, with Supabase's API roles and every
// migration applied, and removed afterwards. Nothing here touches any other
// database.
//
// Requires PostgreSQL server binaries (initdb, pg_ctl, psql). Set PG_BIN to
// their folder, or have them on PATH, or installed under C:\Program Files\PostgreSQL.

import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
const exe = process.platform === "win32" ? ".exe" : "";

function findPgBin() {
  const candidates = [process.env.PG_BIN];
  if (process.platform === "win32") for (const v of ["17", "16", "15"]) candidates.push(`C:\\Program Files\\PostgreSQL\\${v}\\bin`);
  for (const dir of candidates) if (dir && existsSync(join(dir, `initdb${exe}`)) && existsSync(join(dir, `pg_ctl${exe}`))) return dir;
  return "";
}

const PG_BIN = findPgBin();
const bin = (name) => (PG_BIN ? join(PG_BIN, `${name}${exe}`) : name);

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

export async function startCluster() {
  const dir = mkdtempSync(join(tmpdir(), "mintapp-pg-test-"));
  const data = join(dir, "data");
  execFileSync(bin("initdb"), ["-D", data, "-U", "postgres", "-A", "trust", "-E", "UTF8", "--no-locale"], { stdio: "ignore" });
  const port = await freePort();
  execFileSync(bin("pg_ctl"), ["-D", data, "-l", join(dir, "server.log"), "-o", `-p ${port} -c listen_addresses=127.0.0.1`, "-w", "start"], { stdio: "ignore" });

  const args = (sql) => ["-h", "127.0.0.1", "-p", String(port), "-U", "postgres", "-d", "postgres", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql];
  const psql = (sql) => execFileSync(bin("psql"), args(sql), { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const psqlExpectError = (sql) => {
    try {
      psql(sql);
    } catch (err) {
      return String(err.stderr ?? err.message);
    }
    assert.fail("expected the SQL to fail");
  };
  const psqlAsync = (sql) =>
    new Promise((resolve) => {
      const child = spawn(bin("psql"), args(sql));
      let out = "";
      let errOut = "";
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (errOut += d));
      child.on("close", (code) => resolve({ code, out: out.trim(), err: errOut.trim() }));
    });
  const applyMigration = (file) =>
    execFileSync(bin("psql"), ["-h", "127.0.0.1", "-p", String(port), "-U", "postgres", "-d", "postgres", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", join(MIGRATIONS_DIR, file)], { stdio: ["ignore", "pipe", "pipe"] });

  psql("create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;");
  const migrations = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();

  const stop = () => {
    try {
      execFileSync(bin("pg_ctl"), ["-D", data, "-m", "fast", "-w", "stop"], { stdio: "ignore" });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  return { psql, psqlExpectError, psqlAsync, applyMigration, migrations, stop };
}

export const lit = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
