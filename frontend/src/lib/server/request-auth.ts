// Server-only module (Node.js, not for the browser bundle): constant-time
// validation of the bearer tokens that gate the API routes — ADMIN_API_TOKEN
// in api/schedules.ts and CRON_SECRET in api/send-scheduled-reports.ts.
//
// Both used plain `===` before. String comparison short-circuits on the first
// differing byte, so response timing leaks how much of a guess was correct and
// a token can be recovered a character at a time.
//
// Deliberately NOT reusing tokensMatch() from scheduled-reports/crypto.ts,
// even though it looks like the same job. That helper is written for
// hex-encoded SHA-256 digests and decodes its inputs with
// Buffer.from(value, "hex"), which silently stops at the first non-hex
// character. Feeding it an arbitrary bearer token collapses it to almost
// nothing: "Bearer <anything>" decodes to the single byte 0xBE, so every
// token beginning with "Be" would compare equal to every other one — turning
// a hardening change into an authentication bypass.
//
// Hashing both sides to a fixed 32 bytes first keeps timingSafeEqual (which
// throws when the buffers differ in length) safe for inputs of any size, and
// keeps the comparison itself from revealing the expected token's length.

import { createHash, timingSafeEqual } from "crypto";

export function timingSafeStringEqual(left: string, right: string): boolean {
  const leftDigest = createHash("sha256").update(left, "utf8").digest();
  const rightDigest = createHash("sha256").update(right, "utf8").digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

// Returns false whenever the expected secret is missing, so an unset env var
// can never leave an endpoint open.
export function isBearerTokenValid(
  authorizationHeader: string | undefined,
  expectedToken: string | null | undefined,
): boolean {
  if (!expectedToken) {
    return false;
  }

  if (typeof authorizationHeader !== "string") {
    return false;
  }

  return timingSafeStringEqual(authorizationHeader, `Bearer ${expectedToken}`);
}
