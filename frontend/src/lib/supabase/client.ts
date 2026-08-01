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
      // As três ficavam desligadas porque o app não tinha login: a anon key
      // era a única credencial e não havia sessão para guardar. Agora a
      // policy de leitura de aws_sns exige o papel `authenticated`, então a
      // sessão precisa sobreviver a reloads (persistSession) e o access token
      // precisa se renovar sozinho (autoRefreshToken) — sem o segundo, a
      // sessão expira em cerca de uma hora e a investigação morre no meio.
      persistSession: true,
      autoRefreshToken: true,
      // Segue desligado: só existe login por e-mail/senha, que não volta por
      // redirect com token no fragmento da URL. Ligar isto exigiria conferir
      // que a leitura do hash não conflita com os parâmetros de filtro que o
      // app já mantém na URL. Reavaliar se entrar magic link ou OAuth.
      detectSessionInUrl: false,
    },
  });

  return cachedClient;
}
