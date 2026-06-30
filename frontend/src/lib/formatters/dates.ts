import { getSupabaseLanguage } from "@/lib/supabase/settings";

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Não disponível";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Não disponível";
  }

  return new Intl.DateTimeFormat(getSupabaseLanguage(), {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
