// Lists the models the configured CodeCraft key can use, with their stated
// capabilities, so CODECRAFT_MODEL is set to an exact, real id.
// Never prints the key.
//
//   node --env-file=.env.local scripts/codecraft-models.mjs

const key = process.env.CODECRAFT_API_KEY?.trim();
const base = (process.env.CODECRAFT_BASE_URL?.trim() || "https://codecraftapi.com/v1").replace(/\/+$/, "");
if (!key) {
  console.error("CODECRAFT_API_KEY is not set (add it to .env.local; do not commit it).");
  process.exit(1);
}

const res = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" } });
console.log(`GET ${base}/models -> HTTP ${res.status}`);
const body = await res.json().catch(() => null);
if (!res.ok || !Array.isArray(body?.data)) {
  console.error("Unexpected response; no model list.");
  process.exit(1);
}
for (const m of body.data) {
  console.log(
    [
      m.id,
      `owned_by=${m.owned_by ?? "?"}`,
      `context=${m.context_window ?? "?"}`,
      `capabilities=${Array.isArray(m.capabilities) ? m.capabilities.join("+") : "?"}`,
      m.pricing ? `price_in/1k=${m.pricing.input_per_1k} price_out/1k=${m.pricing.output_per_1k}` : "",
    ].join("  "),
  );
}
