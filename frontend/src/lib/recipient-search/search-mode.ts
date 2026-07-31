import type { RecipientSearchMode } from "@/lib/supabase/types";

export const DEFAULT_SEARCH_MODE: RecipientSearchMode = "recipient";

export function parseSearchMode(value: string | null | undefined): RecipientSearchMode {
  return value === "all" || value === "sender" || value === "provider" ? value : DEFAULT_SEARCH_MODE;
}
