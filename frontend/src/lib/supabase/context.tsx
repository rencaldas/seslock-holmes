import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/env";
import { AUTH_REQUIRED_EVENT } from "@/lib/supabase/auth";
import {
  getSupabaseLanguage,
  loadSupabaseSettings,
  SUPABASE_SETTINGS_UPDATED_EVENT,
  syncDocumentLanguage,
} from "@/lib/supabase/settings";

type SupabaseState = {
  client: SupabaseClient | null;
  ready: boolean;
  error: string | null;
  eventsTable: string | null;
  triedTables: string[];
  // True when this browser has no Settings override — i.e. it's using this
  // deployment's own default Supabase project. Scheduled-reports management
  // for that project goes through the admin-gated /api/schedules API
  // instead of direct supabase-js calls; see admin-queries.ts.
  isDefaultProject: boolean;
  adminToken: string | null;
  // Sessão do Supabase Auth, quando existe. `null` é o estado normal de quem
  // usa um projeto com a RLS aberta — não é sinal de erro.
  session: Session | null;
  // Passa a true quando alguma consulta é recusada por permissão. Só então a
  // tela de login aparece; ver o comentário de topo em supabase/auth.ts.
  authRequired: boolean;
};

const SupabaseContext = createContext<SupabaseState | null>(null);

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const [, setRevision] = useState(0);
  const [session, setSession] = useState<Session | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const env = getSupabaseEnv();
  const client = getSupabaseClient();

  useEffect(() => {
    const refresh = () => {
      setRevision((value) => value + 1);
      syncDocumentLanguage(getSupabaseLanguage());
    };

    window.addEventListener(SUPABASE_SETTINGS_UPDATED_EVENT, refresh);
    window.addEventListener("storage", refresh);

    syncDocumentLanguage(getSupabaseLanguage());

    return () => {
      window.removeEventListener(SUPABASE_SETTINGS_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    const onAuthRequired = () => setAuthRequired(true);
    window.addEventListener(AUTH_REQUIRED_EVENT, onAuthRequired);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, onAuthRequired);
  }, []);

  useEffect(() => {
    if (!client) {
      setSession(null);
      return;
    }

    // onAuthStateChange dispara logo de cara com a sessão restaurada do
    // storage, então ele cobre tanto a leitura inicial quanto login, logout e
    // renovação de token — não é preciso um getSession() separado.
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        // Entrou: o motivo de exigir login deixou de valer. Sem isto a tela
        // de login continuaria no lugar mesmo com a sessão ativa.
        setAuthRequired(false);
      }
    });

    return () => data.subscription.unsubscribe();
  }, [client]);

  const localSettings = loadSupabaseSettings();
  const hasOwnOverride = Boolean(localSettings?.url && localSettings?.anonKey);

  const state: SupabaseState = {
    client,
    ready: Boolean(env),
    error: env
      ? null
      : "As credenciais do Supabase estão ausentes. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY, ou salve-as em Configurações.",
    eventsTable: env?.eventsTable ?? null,
    triedTables: env?.eventsTable ? [env.eventsTable] : [],
    isDefaultProject: !hasOwnOverride,
    adminToken: localSettings?.adminToken || null,
    session,
    authRequired,
  };

  return <SupabaseContext.Provider value={state}>{children}</SupabaseContext.Provider>;
}

export function useSupabase() {
  const value = useContext(SupabaseContext);
  if (!value) {
    throw new Error("useSupabase deve ser usado dentro de SupabaseProvider");
  }

  return value;
}
