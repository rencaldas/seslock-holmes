import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/env";
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
