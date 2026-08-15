import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCurrentUserRole } from "./queries";

function clientWithRpcResult(result: { data: unknown; error: { code: string; message: string } | null }) {
  return { rpc: vi.fn().mockResolvedValue(result) } as unknown as SupabaseClient;
}

describe("fetchCurrentUserRole", () => {
  it("returns manager when the function reports manager", async () => {
    const client = clientWithRpcResult({ data: "manager", error: null });
    await expect(fetchCurrentUserRole(client)).resolves.toBe("manager");
  });

  it("returns viewer when the function reports viewer", async () => {
    const client = clientWithRpcResult({ data: "viewer", error: null });
    await expect(fetchCurrentUserRole(client)).resolves.toBe("viewer");
  });

  it("falls back to manager when the RPC function does not exist yet (unmigrated project)", async () => {
    const client = clientWithRpcResult({
      data: null,
      error: { code: "PGRST202", message: "Could not find the function public.current_user_role" },
    });
    await expect(fetchCurrentUserRole(client)).resolves.toBe("manager");
  });

  it("propagates any other error instead of swallowing it as viewer", async () => {
    const client = clientWithRpcResult({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    await expect(fetchCurrentUserRole(client)).rejects.toEqual({ code: "42501", message: "permission denied" });
  });
});
