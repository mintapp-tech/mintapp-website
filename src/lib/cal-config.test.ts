import { afterEach, describe, expect, test, vi } from "vitest";
import { getCalEventTypeId, getCalEventTypeSlug, getCalWebhookSecret } from "./cal-config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getCalEventTypeSlug — strict <username>/<slug> shape only", () => {
  test("accepts the exact expected shape", () => {
    vi.stubEnv("NEXT_PUBLIC_CAL_LINK", "mintapp/mintapp-discovery-call");
    expect(getCalEventTypeSlug()).toBe("mintapp-discovery-call");
  });

  test("throws when unset", () => {
    vi.stubEnv("NEXT_PUBLIC_CAL_LINK", undefined);
    expect(() => getCalEventTypeSlug()).toThrow();
  });

  test("rejects a full URL", () => {
    vi.stubEnv("NEXT_PUBLIC_CAL_LINK", "https://cal.com/mintapp/mintapp-discovery-call");
    expect(() => getCalEventTypeSlug()).toThrow();
  });

  test("rejects a leading slash", () => {
    vi.stubEnv("NEXT_PUBLIC_CAL_LINK", "/mintapp/mintapp-discovery-call");
    expect(() => getCalEventTypeSlug()).toThrow();
  });

  test("rejects a trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_CAL_LINK", "mintapp/mintapp-discovery-call/");
    expect(() => getCalEventTypeSlug()).toThrow();
  });

  test("rejects a query string", () => {
    vi.stubEnv("NEXT_PUBLIC_CAL_LINK", "mintapp/mintapp-discovery-call?ref=x");
    expect(() => getCalEventTypeSlug()).toThrow();
  });

  test("rejects a fragment", () => {
    vi.stubEnv("NEXT_PUBLIC_CAL_LINK", "mintapp/mintapp-discovery-call#top");
    expect(() => getCalEventTypeSlug()).toThrow();
  });

  test("rejects whitespace", () => {
    vi.stubEnv("NEXT_PUBLIC_CAL_LINK", "mintapp/mintapp discovery call");
    expect(() => getCalEventTypeSlug()).toThrow();
  });

  test("rejects a missing username (no slash)", () => {
    vi.stubEnv("NEXT_PUBLIC_CAL_LINK", "mintapp-discovery-call");
    expect(() => getCalEventTypeSlug()).toThrow();
  });

  test("rejects a missing slug (trailing slash with nothing after)", () => {
    vi.stubEnv("NEXT_PUBLIC_CAL_LINK", "mintapp/");
    expect(() => getCalEventTypeSlug()).toThrow();
  });

  test("rejects extra path segments", () => {
    vi.stubEnv("NEXT_PUBLIC_CAL_LINK", "mintapp/team/mintapp-discovery-call");
    expect(() => getCalEventTypeSlug()).toThrow();
  });
});

describe("getCalEventTypeId", () => {
  test("parses a valid positive integer", () => {
    vi.stubEnv("CAL_EVENT_TYPE_ID", "6790027");
    expect(getCalEventTypeId()).toBe(6790027);
  });

  test("throws when unset", () => {
    vi.stubEnv("CAL_EVENT_TYPE_ID", undefined);
    expect(() => getCalEventTypeId()).toThrow();
  });

  test("throws on a non-numeric value", () => {
    vi.stubEnv("CAL_EVENT_TYPE_ID", "not-a-number");
    expect(() => getCalEventTypeId()).toThrow();
  });

  test("throws on zero or negative values", () => {
    vi.stubEnv("CAL_EVENT_TYPE_ID", "0");
    expect(() => getCalEventTypeId()).toThrow();
    vi.stubEnv("CAL_EVENT_TYPE_ID", "-5");
    expect(() => getCalEventTypeId()).toThrow();
  });
});

describe("getCalWebhookSecret", () => {
  test("returns the configured value", () => {
    vi.stubEnv("CAL_WEBHOOK_SECRET", "test-secret-value");
    expect(getCalWebhookSecret()).toBe("test-secret-value");
  });

  test("throws when unset", () => {
    vi.stubEnv("CAL_WEBHOOK_SECRET", undefined);
    expect(() => getCalWebhookSecret()).toThrow();
  });
});
