// Login por e-mail/senha e a detecção de "esta consulta falhou por falta de
// permissão", que é o que decide quando a tela de login aparece.
//
// O app NÃO exige login sempre. A tela só entra quando uma consulta é negada
// por permissão, e isso é deliberado: quem aponta o painel para um Supabase
// próprio com a RLS aberta continua entrando direto, sem conta e sem
// configurar Auth. No projeto canônico, onde a policy de aws_sns exige o papel
// `authenticated`, a primeira consulta falha e o login aparece.
//
// A alternativa — exigir sessão sempre — quebraria todo mundo que usa o
// próprio Supabase, que é justamente o que os campos de URL e chave anon em
// Configurações existem para permitir.

import type { AuthError, Session, SupabaseClient } from "@supabase/supabase-js";

// Emitido quando uma consulta é recusada por permissão. A trilha é
// QueryCache.onError (app/providers.tsx) → aqui → SupabaseProvider, que passa
// a renderizar o login. Segue o mesmo padrão de CustomEvent que
// supabase/settings.ts já usa para propagar mudanças fora da árvore React.
export const AUTH_REQUIRED_EVENT = "seslock-holmes:auth-required";

// Códigos do PostgREST/PostgreSQL para acesso negado por RLS. 42501 é
// "insufficient_privilege"; PGRST301 é o JWT ausente/expirado do PostgREST.
const PERMISSION_DENIED_CODES = new Set(["42501", "PGRST301"]);

interface MaybePostgrestError {
  code?: unknown;
  status?: unknown;
  message?: unknown;
}

// Uma consulta negada por RLS não é "erro genérico": é a diferença entre
// mostrar um erro sem saída e mostrar a tela de login. Casar pelo código é o
// caminho confiável; o texto entra só como rede porque nem toda camada do
// PostgREST propaga o código.
export function isPermissionDeniedError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as MaybePostgrestError;

  if (typeof candidate.code === "string" && PERMISSION_DENIED_CODES.has(candidate.code)) {
    return true;
  }

  if (candidate.status === 401 || candidate.status === 403) {
    return true;
  }

  const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";
  return message.includes("permission denied") || message.includes("jwt expired");
}

export function notifyAuthRequired() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_REQUIRED_EVENT));
}

export async function getActiveSession(client: SupabaseClient): Promise<Session | null> {
  const { data } = await client.auth.getSession();
  return data.session;
}

export interface SignInResult {
  session: Session | null;
  error: AuthError | null;
}

export async function signInWithPassword(
  client: SupabaseClient,
  email: string,
  password: string,
): Promise<SignInResult> {
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  return { session: data.session ?? null, error };
}

export async function signOut(client: SupabaseClient) {
  await client.auth.signOut();
}
