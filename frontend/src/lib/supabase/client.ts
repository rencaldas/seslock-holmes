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
      // Sessão precisa sobreviver a reloads e o token precisa se renovar
      // sozinho — sem autoRefreshToken a sessão expira em ~1h e a
      // investigação morre no meio. Ver docs/SECURITY.md#modelo-de-acesso-rls-é-a-fonte-da-verdade.
      persistSession: true,
      autoRefreshToken: true,
      // Só existe login por e-mail/senha (sem redirect com token no
      // fragmento da URL). Reavaliar se entrar magic link ou OAuth — checar
      // conflito com os parâmetros de filtro que o app mantém na URL.
      detectSessionInUrl: false,
    },
  });

  return cachedClient;
}
