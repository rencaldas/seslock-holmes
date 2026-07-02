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

export function formatDateTimeLocalInputValue(value: string | Date | null | undefined) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (input: number) => String(input).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
