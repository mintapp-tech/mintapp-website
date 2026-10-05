// A LOCAL TEST STAND-IN for Supabase Auth (GoTrue), for synthetic accounts
// only. It is not Supabase: it implements just the endpoints the admin
// application uses, modelled on GoTrue's behaviour as called by
// @supabase/supabase-js, so login, MFA, sign-out and refusals can be tested
// end to end without any remote project. Behaviour must still be confirmed
// against a real Supabase project before launch.
//
//   - password sign-in (no sign-up endpoint exists here)
//   - refresh-token rotation; signed HS256 access tokens with session_id,
//     aal and amr claims
//   - /user refuses tokens whose session was signed out ("session_not_found")
//   - TOTP factors: enroll, challenge, verify (RFC 6238), unenroll; a second
//     factor needs an aal2 session ("insufficient_aal")
//   - logout with scope local, global or others
//
//   node tests/admin/fake-supabase-auth.mjs --port 3299
//   (accounts from FAKE_AUTH_USERS JSON, or the synthetic demo accounts with
//   DASHBOARD_DEMO_PASSWORD)

import { createServer } from "node:http";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { newTotpSecret, verifyTotp } from "./totp.mjs";

const b64 = (value) => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");

export function startFakeAuth({ port = 0, users, tokenTtlSeconds = 3600 } = {}) {
  const jwtSecret = randomBytes(32);
  const accounts = new Map(
    users.map((u) => [u.email.toLowerCase(), { id: randomUUID(), email: u.email.toLowerCase(), password: u.password, factors: [], created_at: new Date().toISOString() }]),
  );
  const sessions = new Map(); // id -> { id, userId, aal, amr, refresh, revoked }
  const challenges = new Map();
  const failures = new Map();

  const sign = (claims) => {
    const data = `${b64({ alg: "HS256", typ: "JWT" })}.${b64(claims)}`;
    return `${data}.${createHmac("sha256", jwtSecret).update(data).digest("base64url")}`;
  };
  const verify = (token) => {
    const [h, p, s] = (token ?? "").split(".");
    if (!h || !p || !s) return null;
    const expected = Buffer.from(createHmac("sha256", jwtSecret).update(`${h}.${p}`).digest("base64url"));
    if (expected.length !== Buffer.from(s).length || !timingSafeEqual(expected, Buffer.from(s))) return null;
    const claims = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
    return claims.exp * 1000 > Date.now() ? claims : null;
  };
  const accountById = (id) => [...accounts.values()].find((a) => a.id === id);
  const publicUser = (a) => ({
    id: a.id,
    aud: "authenticated",
    role: "authenticated",
    email: a.email,
    email_confirmed_at: a.created_at,
    phone: "",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
    created_at: a.created_at,
    updated_at: a.created_at,
    factors: a.factors.map(({ id, friendly_name, factor_type, status, created_at }) => ({ id, friendly_name, factor_type, status, created_at, updated_at: created_at })),
  });
  const issue = (session) => {
    const a = accountById(session.userId);
    const now = Math.floor(Date.now() / 1000);
    session.refresh = randomBytes(24).toString("base64url");
    const access = sign({ sub: a.id, email: a.email, aud: "authenticated", role: "authenticated", iat: now, exp: now + tokenTtlSeconds, session_id: session.id, aal: session.aal, amr: session.amr, is_anonymous: false });
    return { access_token: access, token_type: "bearer", expires_in: tokenTtlSeconds, expires_at: now + tokenTtlSeconds, refresh_token: session.refresh, user: publicUser(a) };
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://local");
    const send = (status, body) => {
      res.writeHead(status, { "Content-Type": "application/json", "X-Supabase-Api-Version": "2024-01-01" });
      res.end(body === undefined ? "" : JSON.stringify(body));
    };
    const fail = (status, code, message) => send(status, { code, error_code: code, msg: message, message });
    let body = {};
    if (req.method !== "GET") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
    }
    const path = url.pathname.replace(/^\/auth\/v1/, "");
    const bearer = (req.headers.authorization ?? "").replace(/^Bearer /, "");
    const current = () => {
      const claims = verify(bearer);
      if (!claims) return { error: () => fail(401, "bad_jwt", "invalid JWT") };
      const session = sessions.get(claims.session_id);
      if (!session || session.revoked) return { error: () => fail(403, "session_not_found", "Session from session_id claim in JWT does not exist") };
      return { session, account: accountById(session.userId) };
    };

    if (req.method === "POST" && path === "/token" && url.searchParams.get("grant_type") === "password") {
      const key = String(body.email ?? "").toLowerCase();
      const recent = (failures.get(key) ?? []).filter((t) => t > Date.now() - 5 * 60_000);
      if (recent.length >= 10) return fail(429, "over_request_rate_limit", "Request rate limit reached");
      const account = accounts.get(key);
      if (!account || account.password !== body.password) {
        failures.set(key, [...recent, Date.now()]);
        return fail(400, "invalid_credentials", "Invalid login credentials");
      }
      const session = { id: randomUUID(), userId: account.id, aal: "aal1", amr: [{ method: "password", timestamp: Math.floor(Date.now() / 1000) }], revoked: false };
      sessions.set(session.id, session);
      return send(200, issue(session));
    }
    if (req.method === "POST" && path === "/token" && url.searchParams.get("grant_type") === "refresh_token") {
      const session = [...sessions.values()].find((s) => s.refresh && s.refresh === body.refresh_token && !s.revoked);
      if (!session) return fail(400, "refresh_token_not_found", "Invalid Refresh Token: Refresh Token Not Found");
      return send(200, issue(session));
    }
    if (req.method === "GET" && path === "/user") {
      const c = current();
      return c.error ? c.error() : send(200, publicUser(c.account));
    }
    if (req.method === "POST" && path === "/logout") {
      const c = current();
      if (c.error) return c.error();
      const scope = url.searchParams.get("scope") ?? "global";
      for (const s of sessions.values()) {
        if (s.userId !== c.account.id) continue;
        if (scope === "global" || (scope === "local" && s.id === c.session.id) || (scope === "others" && s.id !== c.session.id)) s.revoked = true;
      }
      res.writeHead(204, { "X-Supabase-Api-Version": "2024-01-01" });
      return res.end();
    }
    if (req.method === "POST" && path === "/factors") {
      const c = current();
      if (c.error) return c.error();
      if (c.account.factors.some((f) => f.status === "verified") && c.session.aal !== "aal2") return fail(403, "insufficient_aal", "AAL2 required to enroll a new factor");
      const factor = { id: randomUUID(), friendly_name: body.friendly_name, factor_type: "totp", status: "unverified", secret: newTotpSecret(), created_at: new Date().toISOString() };
      c.account.factors.push(factor);
      const qr =
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 184 184' width='184' height='184'><rect width='184' height='184' rx='12' fill='rgb(238,242,238)'/><text x='92' y='86' font-family='sans-serif' font-size='13' text-anchor='middle' fill='rgb(79,89,85)'>QR code</text><text x='92' y='106' font-family='sans-serif' font-size='11' text-anchor='middle' fill='rgb(107,115,111)'>(local test stand-in)</text></svg>";
      return send(200, { id: factor.id, type: "totp", friendly_name: factor.friendly_name, totp: { qr_code: qr, secret: factor.secret, uri: `otpauth://totp/${encodeURIComponent(body.issuer ?? "Mintapp")}:${c.account.email}?secret=${factor.secret}` } });
    }
    const factorRoute = /^\/factors\/([^/]+)(?:\/(challenge|verify))?$/.exec(path);
    if (factorRoute) {
      const c = current();
      if (c.error) return c.error();
      const factor = c.account.factors.find((f) => f.id === factorRoute[1]);
      if (!factor) return fail(404, "mfa_factor_not_found", "Factor not found");
      if (req.method === "DELETE" && !factorRoute[2]) {
        if (factor.status === "verified" && c.session.aal !== "aal2") return fail(403, "insufficient_aal", "AAL2 required to unenroll a verified factor");
        c.account.factors = c.account.factors.filter((f) => f !== factor);
        return send(200, { id: factor.id });
      }
      if (req.method === "POST" && factorRoute[2] === "challenge") {
        const challenge = { id: randomUUID(), factorId: factor.id, expires: Date.now() + 5 * 60_000 };
        challenges.set(challenge.id, challenge);
        return send(200, { id: challenge.id, type: "totp", expires_at: Math.floor(challenge.expires / 1000) });
      }
      if (req.method === "POST" && factorRoute[2] === "verify") {
        const challenge = challenges.get(body.challenge_id);
        challenges.delete(body.challenge_id);
        if (!challenge || challenge.factorId !== factor.id || challenge.expires < Date.now()) return fail(422, "mfa_challenge_expired", "Challenge expired or not found");
        if (!verifyTotp(factor.secret, String(body.code ?? ""))) return fail(422, "mfa_verification_failed", "Invalid TOTP code entered");
        factor.status = "verified";
        c.session.aal = "aal2";
        c.session.amr = [{ method: "totp", timestamp: Math.floor(Date.now() / 1000) }, ...c.session.amr];
        return send(200, issue(c.session));
      }
    }
    fail(404, "not_found", "Not found"); // includes /signup: sign-up does not exist here
  });

  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({ port: server.address().port, close: () => server.close(), sessions })));
}

// CLI
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  const port = Number(process.argv[process.argv.indexOf("--port") + 1]) || 3299;
  const password = process.env.DASHBOARD_DEMO_PASSWORD;
  const users = process.env.FAKE_AUTH_USERS
    ? JSON.parse(process.env.FAKE_AUTH_USERS)
    : ["omar.demo@mintapp.local", "adam.demo@mintapp.local", "outsider.demo@mintapp.local"].map((email) => ({ email, password }));
  const { port: bound } = await startFakeAuth({ port, users });
  console.log(`Local Supabase Auth stand-in (synthetic accounts only) on http://127.0.0.1:${bound}/auth/v1`);
}
