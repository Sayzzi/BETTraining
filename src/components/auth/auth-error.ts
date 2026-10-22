const KNOWN_CODES = [
  "INVALID_EMAIL_OR_PASSWORD",
  "USER_ALREADY_EXISTS",
  "PASSWORD_TOO_SHORT",
  "INVALID_EMAIL",
] as const;

export type AuthErrorKey = (typeof KNOWN_CODES)[number] | "unknown";

// Better Auth codes can carry suffixes (e.g. USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL).
export function toAuthErrorKey(code: string | undefined): AuthErrorKey {
  if (!code) return "unknown";
  return KNOWN_CODES.find((known) => code.startsWith(known)) ?? "unknown";
}
