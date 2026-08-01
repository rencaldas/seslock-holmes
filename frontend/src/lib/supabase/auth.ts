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
//
// ⚠️ DEPENDÊNCIA DE CONFIGURAÇÃO DO BANCO — não é suficiente ter a RLS certa.
//
// A RLS sozinha NÃO faz este arquivo funcionar. Ela não gera erro em SELECT:
// quando nenhuma policy casa com o papel, o PostgREST devolve 200 com lista
// vazia, que é indistinguível de "não há eventos no período". Nesse cenário
// isPermissionDeniedError nunca dispara, a tela de login nunca aparece, e
// quem não tem sessão fica preso num painel vazio sem nenhum caminho para
// entrar.
//
// O que faz a recusa virar erro de verdade (42501) é o GRANT da tabela estar
// revogado para anon — ver
// supabase/migrations/20260801025740_revoke_anon_grants_to_surface_auth_error.sql.
//
// Se a tela de login parar de aparecer, suspeite disto antes do código:
//
//   select has_table_privilege('anon','public.aws_sns','SELECT');  -- deve ser false
//
// Alguns assistentes de configuração do painel do Supabase recriam esses
// GRANTs silenciosamente ao mexer em policies.

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
