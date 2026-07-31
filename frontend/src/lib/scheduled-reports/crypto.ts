// Server-only module (Node.js, not for the browser bundle) — encrypts the
// secrets (external Supabase service role keys, Gmail app passwords) stored
// in `report_connections` so a visitor who registers their own project's
// automatic delivery never has that project's credentials sitting in
// plaintext in this app's own database. See api/connections.ts.
//
// The encryption key is derived from CONNECTIONS_ENCRYPTION_KEY (any string,
// hashed down to 32 bytes with SHA-256) rather than requiring it to already
// be a valid AES-256 key — one less way for the env var to be misconfigured.
//
// Only relative imports/`.js` extensions are used because Vercel's Node.js
// function bundler ships each file separately rather than bundling them, so
// Node's own ESM loader (which requires explicit extensions) resolves these
// at runtime — see the matching comment in report-runner.ts.

import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "crypto";

function getKey(): Buffer {
  const secret = process.env.CONNECTIONS_ENCRYPTION_KEY?.trim();
  if (!secret) {
    throw new Error("CONNECTIONS_ENCRYPTION_KEY não configurada nas variáveis de ambiente do Vercel.");
  }
  return createHash("sha256").update(secret).digest();
}

// AES-256-GCM: iv (12 bytes) + auth tag (16 bytes) + ciphertext, each
// base64-encoded and dot-joined into a single string column value.
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(".");
}

export function decryptSecret(encoded: string): string {
  const [ivB64, tagB64, dataB64] = encoded.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Formato de segredo criptografado inválido.");
  }

  const key = getKey();
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// The management token for a connection is shown to the caller exactly once
// (at creation time) and never stored — only its hash is, so a copy of the
// report_connections table (a Supabase dashboard export, a leaked backup)
// can't be used to impersonate a tenant.
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Constant-time comparison so responding faster/slower on a near-miss token
// can't be used to brute-force it a character at a time.
export function tokensMatch(hashA: string, hashB: string): boolean {
  const bufferA = Buffer.from(hashA, "hex");
  const bufferB = Buffer.from(hashB, "hex");
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}
