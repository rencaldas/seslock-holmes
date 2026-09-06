// Server-only module (Node.js, not for the browser bundle): constant-time
// validation of the bearer tokens that gate the API routes — ADMIN_API_TOKEN
// in api/schedules.ts and CRON_SECRET in api/send-scheduled-reports.ts.
//
// Both used to compare with plain `===` (timing leak), and a since-removed
// helper this could have reused instead had a hex-decoding bug that would
// have made it an authentication bypass. See
// docs/SECURITY.md#incidente-comparação-de-tokens-em-tempo-constante before
// touching this file or its test.

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
