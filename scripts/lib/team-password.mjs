// scrypt password hashing shared by the app and the account scripts.
// Format: scrypt$<N>$<r>$<p>$<salt base64url>$<hash base64url>

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";

const N = 32768;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 128 * 1024 * 1024;

const derive = (password, salt, n, r, p) =>
  new Promise((resolve, reject) => scryptCb(password.normalize("NFKC"), salt, KEYLEN, { N: n, r, p, maxmem: MAXMEM }, (err, key) => (err ? reject(err) : resolve(key))));

export const MIN_PASSWORD_LENGTH = 16;

export async function hashPassword(password) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) throw new Error(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export const HASH_PATTERN = /^scrypt\$(\d+)\$(\d+)\$(\d+)\$([A-Za-z0-9_-]{16,})\$([A-Za-z0-9_-]{60,})$/;

export async function verifyPassword(password, encoded) {
  const m = typeof encoded === "string" ? HASH_PATTERN.exec(encoded) : null;
  if (!m || typeof password !== "string") return false;
  const [n, r, p] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (n < 16384 || n > 1048576 || r < 8 || r > 16 || p < 1 || p > 4) return false;
  const expected = Buffer.from(m[5], "base64url");
  if (expected.length !== KEYLEN) return false;
  const actual = await derive(password, Buffer.from(m[4], "base64url"), n, r, p);
  return timingSafeEqual(actual, expected);
}
