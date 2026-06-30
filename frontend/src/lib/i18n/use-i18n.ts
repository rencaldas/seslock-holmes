import { useMemo, useSyncExternalStore } from "react";
import { getSupabaseLanguage, SUPABASE_SETTINGS_UPDATED_EVENT } from "@/lib/supabase/settings";
import { translations } from "@/lib/i18n/messages";
import type { AppLanguage, TranslationBundle } from "@/lib/i18n/types";

function subscribe(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(SUPABASE_SETTINGS_UPDATED_EVENT, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(SUPABASE_SETTINGS_UPDATED_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot() {
  return getSupabaseLanguage();
}

function getServerSnapshot() {
  return "pt-BR" as AppLanguage;
}

export function useAppLanguage() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useI18n(): TranslationBundle {
  const language = useAppLanguage();

  return useMemo(() => translations[language], [language]);
}
