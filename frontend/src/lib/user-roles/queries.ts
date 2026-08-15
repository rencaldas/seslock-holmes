import type { SupabaseClient } from "@supabase/supabase-js";

export type UserRole = "viewer" | "manager";

// Código do PostgREST para "função não encontrada no schema cache" — a
// migration 20260814090000 ainda não foi aplicada no projeto em uso. Todo
// authenticated tinha CRUD completo antes desta migration, então o fallback
// aqui precisa ser "manager" (o comportamento de sempre), nunca "viewer" —
// senão um projeto self-hosted que não migrou perde acesso silenciosamente
// no primeiro deploy deste código.
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
