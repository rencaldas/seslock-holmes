import type { SupabaseClient } from "@supabase/supabase-js";

export type UserRole = "viewer" | "manager";

// PGRST202 = função RPC não encontrada (migration 20260814090000 não
// aplicada). Fallback precisa ser "manager", nunca "viewer" — ver
// docs/ARCHITECTURE.md#rbac-leve-viewer-e-manager.
const UNDEFINED_FUNCTION_ERROR_CODE = "PGRST202";

export async function fetchCurrentUserRole(client: SupabaseClient): Promise<UserRole> {
  const { data, error } = await client.rpc("current_user_role");

  if (error) {
    if (error.code === UNDEFINED_FUNCTION_ERROR_CODE) {
      return "manager";
    }
    throw error;
  }

  return data === "manager" ? "manager" : "viewer";
}
