import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/env";
import { getSupabaseLanguage, SUPABASE_SETTINGS_UPDATED_EVENT, syncDocumentLanguage } from "@/lib/supabase/settings";

type SupabaseState = {
  client: SupabaseClient | null;
  ready: boolean;
  error: string | null;
  eventsTable: string | null;
  triedTables: string[];
};

const SupabaseContext = createContext<SupabaseState | null>(null);

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const [, setRevision] = useState(0);
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

  const state: SupabaseState = {
    client,
    ready: Boolean(env),
    error: env
      ? null
      : "As credenciais do Supabase estao ausentes. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY, ou salve-as em Configuracoes.",
    eventsTable: env?.eventsTable ?? null,
    triedTables: env?.eventsTable ? [env.eventsTable] : [],
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
