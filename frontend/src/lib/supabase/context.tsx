import { createContext, useContext, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/env";

type SupabaseState = {
  client: SupabaseClient | null;
  ready: boolean;
  error: string | null;
  eventsTable: string | null;
  triedTables: string[];
};

const SupabaseContext = createContext<SupabaseState | null>(null);

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const env = getSupabaseEnv();
  const client = getSupabaseClient();
  const state: SupabaseState = {
    client,
    ready: Boolean(env),
    error: env
      ? null
      : "As variáveis de ambiente do Supabase estão ausentes. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY, ou o equivalente NEXT_PUBLIC_*.",
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
