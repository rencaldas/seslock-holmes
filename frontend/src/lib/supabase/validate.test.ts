/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { validateSupabaseCredentials } from "./validate";

const VALID_URL = "https://lvmqnxompwxbfkabbftq.supabase.co";
const VALID_KEY = "sb_publishable_72TOER8HurEYdg63XkyE2A_5eACiAKl";

describe("validateSupabaseCredentials", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects garbage input without making a network call", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await validateSupabaseCredentials("not a url", "anything");

    expect(result).toEqual({ valid: false, errorCode: "invalidUrl" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a plausible URL with an implausible key without a network call", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await validateSupabaseCredentials(VALID_URL, "not-a-real-key");

    expect(result).toEqual({ valid: false, errorCode: "invalidKey" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a non-https URL", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await validateSupabaseCredentials("http://example.supabase.co", VALID_KEY);

    expect(result).toEqual({ valid: false, errorCode: "invalidUrl" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reports credentialsRejected when Supabase returns 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );

    const result = await validateSupabaseCredentials(VALID_URL, VALID_KEY);

    expect(result).toEqual({ valid: false, errorCode: "credentialsRejected" });
  });

  it("reports connectionFailed when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await validateSupabaseCredentials(VALID_URL, VALID_KEY);

    expect(result).toEqual({ valid: false, errorCode: "connectionFailed" });
  });

  it("reports valid when Supabase responds with 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 200 })),
    );

    const result = await validateSupabaseCredentials(VALID_URL, VALID_KEY);

    expect(result).toEqual({ valid: true });
  });

  it("checks auth/v1/settings (accepts anon/publishable keys) rather than rest/v1/ (which now requires a secret key)", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    await validateSupabaseCredentials(VALID_URL, VALID_KEY);

    const call = fetchSpy.mock.calls[0]!;
    const [requestedUrl, requestInit] = call;
    expect(new URL(requestedUrl as URL).pathname).toBe("/auth/v1/settings");
    expect((requestInit as RequestInit).headers).toMatchObject({ apikey: VALID_KEY });
  });
});
