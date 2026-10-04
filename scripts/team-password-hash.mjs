// Generates a password hash for a Mintapp team dashboard account, to put in
// the server-only TEAM_ACCOUNTS variable. The password is typed without being
// shown and is never written anywhere; only the hash is printed.
//
//   node scripts/team-password-hash.mjs

import { hashPassword, MIN_PASSWORD_LENGTH } from "./lib/team-password.mjs";

function readHidden(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    const stdin = process.stdin;
    let value = "";
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (ch) => {
      if (ch === "\r" || ch === "\n" || ch === "\u0004") {
        stdin.setRawMode?.(false);
        stdin.pause();
        stdin.off("data", onData);
        process.stdout.write("\n");
        resolve(value);
      } else if (ch === "\u0003") {
        process.exit(1);
      } else if (ch === "\u007f" || ch === "\b") {
        value = value.slice(0, -1);
      } else {
        value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

const password = await readHidden(`Password (at least ${MIN_PASSWORD_LENGTH} characters, not shown): `);
const again = await readHidden("Repeat: ");
if (password !== again) {
  console.error("Passwords do not match.");
  process.exit(1);
}
try {
  console.log(await hashPassword(password));
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
