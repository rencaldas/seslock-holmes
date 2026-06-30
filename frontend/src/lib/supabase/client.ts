import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";

let cachedClient: SupabaseClient | null = null;
let cachedSignature = "";

export function getSupabaseClient() {
  const env = getSupabaseEnv();
  if (!env) {
    cachedClient = null;
    cachedSignature = "";
    return null;
  }

  const signature = `${env.url}::${env.anonKey}`;
  if (cachedClient && cachedSignature === signature) {
    return cachedClient;
  }

  cachedSignature = signature;

  cachedClient = createClient(env.url, env.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return cachedClient;
}
