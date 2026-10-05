// Database-level tests for supabase/migrations/20261007000000_add_team_sessions.sql.
//   npm run test:db

import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { startCluster, lit } from "./pg-harness.mjs";

let db;
const H1 = "1".repeat(64);
const H2 = "2".repeat(64);
const EMAIL = "omar@mintapp.tech";
const svc = (sql) => db.psql(`set role service_role; ${sql}`);
const create = (hash, email = EMAIL, hours = 12) => svc(`select public.team_session_create(${lit(hash)}, ${lit(email)}, now() + interval '${hours} hours')`);
const touch = (hash, email = EMAIL, idle = 7200) => svc(`select public.team_session_touch(${lit(hash)}, ${lit(email)}, ${idle})`);

before(async () => {
  db = await startCluster();
  for (const file of db.migrations) db.applyMigration(file);
});
after(() => db?.stop());
beforeEach(() => db.psql("delete from public.team_sessions; delete from public.team_login_attempts;"));

describe("server-side sessions", () => {
  test("a live session is accepted and its last use refreshed; another email or unknown id is not", () => {
    create(H1);
    db.psql(`update public.team_sessions set last_seen_at = now() - interval '10 minutes' where sid_hash = ${lit(H1)}`);
    assert.equal(touch(H1), "t");
    assert.equal(Number(db.psql(`select extract(epoch from now() - last_seen_at)::int from public.team_sessions where sid_hash = ${lit(H1)}`)) < 5, true);
    assert.equal(touch(H1, "adam@mintapp.tech"), "f");
    assert.equal(touch(H2), "f");
  });

  test("revoked, idle and expired sessions are refused", () => {
    create(H1);
    assert.equal(svc(`select public.team_session_revoke(${lit(H1)})`), "t");
    assert.equal(touch(H1), "f");
    create(H2);
    db.psql(`update public.team_sessions set last_seen_at = now() - interval '3 hours' where sid_hash = ${lit(H2)}`);
    assert.equal(touch(H2), "f", "idle for longer than the limit");
    db.psql("delete from public.team_sessions");
    create(H1);
    db.psql(`update public.team_sessions set created_at = now() - interval '13 hours', expires_at = now() - interval '1 hour' where sid_hash = ${lit(H1)}`);
    assert.equal(touch(H1), "f", "past its absolute expiry");
  });

  test("sign out everywhere revokes every session for that person only", () => {
    create(H1);
    create(H2, "adam@mintapp.tech");
    create("3".repeat(64));
    assert.equal(svc(`select public.team_sessions_revoke_all(${lit(EMAIL)})`), "2");
    assert.equal(touch(H1), "f");
    assert.equal(touch(H2, "adam@mintapp.tech"), "t");
  });

  test("only hashes are accepted as session keys", () => {
    assert.match(db.psqlExpectError(`set role service_role; select public.team_session_create('raw-session-id', ${lit(EMAIL)}, now() + interval '1 hour')`), /sid_hash_shape/);
  });
});

describe("throttling with a chosen limit", () => {
  test("locks at the caller's limit; success clears it", () => {
    const key = "a".repeat(64);
    for (let i = 1; i < 30; i++) assert.equal(svc(`select public.team_login_record_limited(${lit(key)}, false, 30)`), "f");
    assert.equal(svc(`select public.team_login_record_limited(${lit(key)}, false, 30)`), "t");
    assert.equal(svc(`select public.team_login_locked(${lit(key)})`), "t");
    svc(`select public.team_login_record_limited(${lit(key)}, true, 30)`);
    assert.equal(svc(`select public.team_login_locked(${lit(key)})`), "f");
  });
});

describe("access", () => {
  test("anon and authenticated cannot read sessions or call the functions", () => {
    for (const role of ["anon", "authenticated"]) {
      assert.match(db.psqlExpectError(`set role ${role}; select count(*) from public.team_sessions;`), /permission denied/);
      assert.match(db.psqlExpectError(`set role ${role}; select public.team_session_touch(${lit(H1)}, ${lit(EMAIL)}, 60);`), /permission denied/);
    }
  });
});
