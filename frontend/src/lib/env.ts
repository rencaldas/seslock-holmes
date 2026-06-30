import { loadSupabaseSettings } from "@/lib/supabase/settings";

export interface SupabaseEnv {
  url: string;
  anonKey: string;
  eventsTable: string;
}

function readEnv(...keys: string[]) {
  for (const key of keys) {
    const value = import.meta.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return null;
}

export function getSupabaseEnv(): SupabaseEnv | null {
  const localSettings = loadSupabaseSettings();
  const url = localSettings?.url || readEnv("VITE_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = localSettings?.anonKey || readEnv(
    "VITE_SUPABASE_ANON_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  );
  const eventsTable =
    localSettings?.eventsTable ||
    readEnv("VITE_SUPABASE_EVENTS_TABLE", "NEXT_PUBLIC_SUPABASE_EVENTS_TABLE") ||
    "aws_sns";

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey, eventsTable };
}
