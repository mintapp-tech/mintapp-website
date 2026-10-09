// Production builds of both surfaces, from the same source:
//   * the public site contains no admin routes and answers /dashboard etc. with not found;
//   * the admin application contains the CRM routes, is closed without configuration
//     (no hosts: it answers nowhere; hosts but no Supabase Auth: nothing private is served);
//   * no server-side secret or service-role name reaches either browser bundle.
// Builds take a few minutes. Nothing here touches a network, a database or an email service.
//   npm run test:build

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { request } from "node:http";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

const root = process.cwd();
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

// Distinctive fake values for every server-side secret: if one appears in a client file, it leaked.
const SECRETS = Object.fromEntries(
  ["SUPABASE_SECRET_KEY", "ADMIN_SESSION_SECRET", "CODECRAFT_API_KEY", "PREPARATION_WORKER_SECRET", "RESEND_API_KEY", "TURNSTILE_SECRET_KEY", "CAL_WEBHOOK_SECRET", "BOOKING_REFERENCE_SECRET"].map((k) => [k, `SENTINEL-${k}-${randomBytes(6).toString("hex")}`]),
);
const BASE_ENV = {
  ...process.env,
  NODE_ENV: undefined,
  NEXT_TELEMETRY_DISABLED: "1",
  SUPABASE_URL: "http://127.0.0.1:9",
  SUPABASE_PUBLISHABLE_KEY: "SENTINEL-publishable-not-a-key",
  EMAIL_SENDING_MODE: "disabled",
  ...SECRETS,
};
delete BASE_ENV.NODE_ENV;

const run = (args, env) => {
  const r = spawnSync(npx, ["next", ...args], { cwd: root, env, encoding: "utf8", shell: process.platform === "win32", maxBuffer: 64 * 1024 * 1024 });
  assert.equal(r.status, 0, `next ${args.join(" ")} failed:\n${(r.stdout ?? "").slice(-2500)}\n${(r.stderr ?? "").slice(-2500)}`);
  return r.stdout;
};

function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}
const read = (path) => readFileSync(path, "utf8");
const routesOf = (dir) => {
  const manifest = JSON.parse(read(join(dir, "app-path-routes-manifest.json")));
  return Object.values(manifest);
};

const ADMIN_ROUTE = /^\/(login|dashboard|pipeline|metrics|proposals|search|inquiries|outreach|companies|contacts|projects|export)(\/|$)/;

const FORBIDDEN_IN_CLIENT = ["service_role", "SUPABASE_SECRET_KEY", "crm_save_company", "crm_export", "ADMIN_SESSION_SECRET", "CODECRAFT_API_KEY", "PREPARATION_WORKER_SECRET", "claim_preparation_job"];

function scanClient(dir) {
  const files = [...walk(join(dir, "static"))].filter((f) => /\.(js|css|html|json|txt|map)$/.test(f));
  assert.ok(files.length > 0, `no client files under ${dir}/static`);
  for (const file of files) {
    const text = read(file);
    for (const [name, value] of Object.entries(SECRETS)) assert.ok(!text.includes(value), `${name}'s value appears in ${file}`);
    for (const word of FORBIDDEN_IN_CLIENT) assert.ok(!text.includes(word), `"${word}" appears in the browser bundle ${file}`);
  }
  // Pre-rendered pages are delivered to browsers too.
  for (const file of [...walk(join(dir, "server", "app"))].filter((f) => f.endsWith(".html"))) {
    const text = read(file);
    for (const value of Object.values(SECRETS)) assert.ok(!text.includes(value), `a secret appears in ${file}`);
  }
}

const get = (port, path, headers = {}) =>
  new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, path, method: "GET", headers }, (res) => {
      let body = "";
      res.setEncoding("utf8").on("data", (d) => (body += d));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on("error", reject);
    req.end();
  });

async function serve(env, port, work) {
  const child = spawn(npx, ["next", "start", "-p", String(port)], { cwd: root, env, shell: process.platform === "win32", stdio: "ignore" });
  try {
    for (let i = 0; i < 120; i++) {
      try {
        await get(port, "/robots.txt", { host: "localhost" });
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    await work();
  } finally {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"]);
    else child.kill();
  }
}

describe("public build", () => {
  before(() => {
    // Start from a clean build directory. A stale .next left by earlier dev and build runs made Turbopack
    // fail on the Manrope font ("next/font/google queries have exactly one entry") on one machine, on main
    // too; the same code builds from a clean directory (see docs/crm-release-1.md, "Build notes").
    rmSync(join(root, ".next"), { recursive: true, force: true });
    run(["build"], { ...BASE_ENV, APP_SURFACE: undefined });
  });

  test("has no CRM or admin routes at all", () => {
    const routes = routesOf(join(root, ".next"));
    assert.ok(routes.length > 5);
    assert.deepEqual(routes.filter((r) => ADMIN_ROUTE.test(r)), []);
    assert.equal([...walk(join(root, ".next", "server", "app"))].some((f) => /(dashboard|inquiries|pipeline|outreach|companies|metrics)[\\/]page\.js$/.test(f)), false);
  });

  test("no server-side secret or database function name reaches a browser bundle", () => {
    scanClient(join(root, ".next"));
  });

  test("answers the admin addresses with not found", async () => {
    await serve({ ...BASE_ENV, APP_SURFACE: undefined, NODE_ENV: "production" }, 3291, async () => {
      for (const path of ["/dashboard", "/login", "/inquiries", "/export/contacts", "/en/dashboard", "/en/inquiries"]) {
        let res = await get(3291, path, { host: "localhost" });
        for (let hop = 0; hop < 3 && res.status >= 300 && res.status < 400; hop++) res = await get(3291, res.headers.location, { host: "localhost" });
        assert.equal(res.status, 404, path);
        assert.doesNotMatch(res.body, /Mintapp admin|Sign in|crm_/);
      }
    });
  });
});

describe("admin build", () => {
  before(() => {
    rmSync(join(root, ".next-admin"), { recursive: true, force: true });
    run(["build"], { ...BASE_ENV, APP_SURFACE: "admin" });
  });

  test("contains every CRM route", () => {
    const routes = routesOf(join(root, ".next-admin"));
    for (const expected of ["/login", "/login/mfa", "/dashboard", "/inquiries", "/inquiries/[id]", "/pipeline", "/outreach", "/outreach/[id]", "/companies", "/companies/[id]", "/contacts/[id]", "/proposals", "/projects", "/projects/[id]", "/metrics", "/search", "/export/[kind]"]) {
      assert.ok(routes.includes(expected), `${expected} is missing from the admin build`);
    }
    // The admin build may contain the public pages' files, but the proxy answers none of them (tested below).
  });

  test("no server-side secret or database function name reaches a browser bundle", () => {
    scanClient(join(root, ".next-admin"));
  });

  test("closed without configuration: no hosts means it answers nowhere", async () => {
    await serve({ ...BASE_ENV, APP_SURFACE: "admin", NODE_ENV: "production", SUPABASE_URL: "", SUPABASE_PUBLISHABLE_KEY: "", ADMIN_HOSTS: "" }, 3292, async () => {
      for (const path of ["/", "/login", "/dashboard", "/inquiries", "/export/contacts"]) {
        const res = await get(3292, path, { host: "localhost" });
        assert.equal(res.status, 404, path);
        assert.equal(res.body, "Not found");
        assert.match(res.headers["x-robots-tag"], /noindex/);
      }
    });
  });

  test("on its host but without sign-in configured, nothing private is served and every page is private", async () => {
    await serve({ ...BASE_ENV, APP_SURFACE: "admin", NODE_ENV: "production", SUPABASE_URL: "", SUPABASE_PUBLISHABLE_KEY: "", ADMIN_HOSTS: "localhost", ADMIN_TEAM: "", ADMIN_SESSION_SECRET: "" }, 3293, async () => {
      for (const path of ["/dashboard", "/inquiries", "/pipeline", "/outreach", "/companies", "/metrics", "/search?q=a"]) {
        const res = await get(3293, path, { host: "localhost" });
        assert.ok([302, 303, 307, 308].includes(res.status), `${path} ${res.status}`);
        assert.match(res.headers.location, /\/login$/);
        assert.doesNotMatch(res.body, /data-summary|<table|Meetings to prepare|Needs attention|Synthetic/, `${path} leaked a page`);
      }
      const login = await get(3293, "/login", { host: "localhost" });
      assert.equal(login.status, 200);
      assert.match(login.headers["cache-control"], /no-store/);
      assert.match(login.headers["strict-transport-security"], /max-age=31536000/);
      assert.match(login.headers["content-security-policy"], /frame-ancestors 'none'/);
      assert.equal(login.headers["x-frame-options"], "DENY");
      assert.match(login.headers["x-robots-tag"], /noindex/);
      // Public pages and the public API are not part of this application.
      for (const path of ["/en", "/ar/start", "/api/inquiries", "/api/webhooks/cal"]) assert.equal((await get(3293, path, { host: "localhost" })).status, 404, path);
      // A host that is not on the list gets nothing.
      assert.equal((await get(3293, "/login", { host: "evil.invalid" })).status, 404);
    });
  });
});

after(() => {});
