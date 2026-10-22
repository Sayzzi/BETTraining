import { describe, expect, it } from "vitest";
import { toAuthErrorKey } from "./auth-error";

describe("toAuthErrorKey", () => {
  it("maps a known Better Auth code to its message key", () => {
    expect(toAuthErrorKey("INVALID_EMAIL_OR_PASSWORD")).toBe("INVALID_EMAIL_OR_PASSWORD");
  });

  it("maps a suffixed code to its base key", () => {
    expect(toAuthErrorKey("USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL")).toBe("USER_ALREADY_EXISTS");
  });

  it("falls back to unknown for missing or unexpected codes", () => {
    expect(toAuthErrorKey(undefined)).toBe("unknown");
    expect(toAuthErrorKey("RATE_LIMITED")).toBe("unknown");
  });
});
