import { describe, expect, it } from "vitest";
import { isBearerTokenValid, timingSafeStringEqual } from "./request-auth";

describe("timingSafeStringEqual", () => {
  it("matches identical strings", () => {
    expect(timingSafeStringEqual("s3cr3t", "s3cr3t")).toBe(true);
  });

  it("rejects strings differing only in the last character", () => {
    expect(timingSafeStringEqual("s3cr3t", "s3cr3u")).toBe(false);
  });

  it("rejects strings of different lengths instead of throwing", () => {
    expect(timingSafeStringEqual("short", "a-much-longer-secret")).toBe(false);
    expect(timingSafeStringEqual("", "x")).toBe(false);
  });

  it("treats two empty strings as equal", () => {
    expect(timingSafeStringEqual("", "")).toBe(true);
  });

  it("is case sensitive", () => {
    expect(timingSafeStringEqual("Token", "token")).toBe(false);
  });

  it("compares multi-byte characters by value", () => {
    expect(timingSafeStringEqual("señha", "señha")).toBe(true);
    expect(timingSafeStringEqual("señha", "senha")).toBe(false);
  });
});

describe("isBearerTokenValid", () => {
  it("accepts a correctly formatted header", () => {
    expect(isBearerTokenValid("Bearer abc123", "abc123")).toBe(true);
  });

  it("rejects a wrong token", () => {
    expect(isBearerTokenValid("Bearer wrong", "abc123")).toBe(false);
  });

  // Regression guard: Buffer.from(value, "hex") stops at the first non-hex
  // character, so a hex-based comparison collapses every "Bearer ..." header
  // to the single byte 0xBE and lets any of them authenticate. These two must
  // never be accepted for the same expected token.
  it("does not let two different tokens sharing a 'Be' prefix collide", () => {
    expect(isBearerTokenValid("Bearer meu-token-secreto", "token-do-atacante")).toBe(false);
    expect(isBearerTokenValid("Bearer token-do-atacante", "meu-token-secreto")).toBe(false);
  });

  it("rejects a header missing the Bearer scheme", () => {
    expect(isBearerTokenValid("abc123", "abc123")).toBe(false);
  });

  it("rejects a different auth scheme carrying the right token", () => {
    expect(isBearerTokenValid("Basic abc123", "abc123")).toBe(false);
  });

  it("rejects when the header is absent", () => {
    expect(isBearerTokenValid(undefined, "abc123")).toBe(false);
  });

  it("rejects every input when the expected token is unset", () => {
    expect(isBearerTokenValid("Bearer abc123", null)).toBe(false);
    expect(isBearerTokenValid("Bearer abc123", undefined)).toBe(false);
    expect(isBearerTokenValid("Bearer ", "")).toBe(false);
    expect(isBearerTokenValid(undefined, null)).toBe(false);
  });

  it("is sensitive to surrounding whitespace", () => {
    expect(isBearerTokenValid("Bearer  abc123", "abc123")).toBe(false);
    expect(isBearerTokenValid("bearer abc123", "abc123")).toBe(false);
  });
});
