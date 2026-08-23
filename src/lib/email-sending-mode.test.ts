import { afterEach, describe, expect, test, vi } from "vitest";
import { EmailSendingModeConfigError, resolveEmailSendingMode } from "./email-sending-mode";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveEmailSendingMode — production requires an explicit value", () => {
  test("production + EMAIL_SENDING_MODE=send resolves to send", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAIL_SENDING_MODE", "send");
    expect(resolveEmailSendingMode()).toBe("send");
  });

  test("production + EMAIL_SENDING_MODE=disabled resolves to disabled", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAIL_SENDING_MODE", "disabled");
    expect(resolveEmailSendingMode()).toBe("disabled");
  });

  test("production + missing EMAIL_SENDING_MODE throws a controlled configuration error", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAIL_SENDING_MODE", undefined);
    expect(() => resolveEmailSendingMode()).toThrow(EmailSendingModeConfigError);
  });

  test("production + an unrecognized EMAIL_SENDING_MODE value throws, never silently guesses", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAIL_SENDING_MODE", "yes-please");
    expect(() => resolveEmailSendingMode()).toThrow(EmailSendingModeConfigError);
  });
});

describe("resolveEmailSendingMode — development defaults to disabled, requires opt-in", () => {
  test("development + unset defaults to disabled", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("EMAIL_SENDING_MODE", undefined);
    expect(resolveEmailSendingMode()).toBe("disabled");
  });

  test("development + EMAIL_SENDING_MODE=send is a deliberate opt-in and resolves to send", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("EMAIL_SENDING_MODE", "send");
    expect(resolveEmailSendingMode()).toBe("send");
  });

  test("development + a garbage value fails toward disabled, not send", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("EMAIL_SENDING_MODE", "definitely-send-it");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(resolveEmailSendingMode()).toBe("disabled");
    spy.mockRestore();
  });
});

describe("resolveEmailSendingMode — test/CI always forces disabled, regardless of the variable", () => {
  test("NODE_ENV=test forces disabled even if EMAIL_SENDING_MODE=send", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("EMAIL_SENDING_MODE", "send");
    expect(resolveEmailSendingMode()).toBe("disabled");
  });

  test("CI=true forces disabled even if EMAIL_SENDING_MODE=send and NODE_ENV=development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CI", "true");
    vi.stubEnv("EMAIL_SENDING_MODE", "send");
    expect(resolveEmailSendingMode()).toBe("disabled");
  });

  test("CI=true forces disabled even if EMAIL_SENDING_MODE=send and NODE_ENV=production", () => {
    // Defensive: the test/CI check runs before the production branch, so
    // this combination (however it might arise) can never leak a real send.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CI", "true");
    vi.stubEnv("EMAIL_SENDING_MODE", "send");
    expect(resolveEmailSendingMode()).toBe("disabled");
  });
});
