import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const env = getSupabaseEnv();
  if (!env) {
    return null;
  }

  cachedClient = createClient(env.url, env.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return cachedClient;
}
