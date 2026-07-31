import { useEffect, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SupabaseProvider } from "@/lib/supabase/context";
import { FiltersProvider } from "@/lib/filters/filters-context";
import { useAppLanguage } from "@/lib/i18n/use-i18n";
import { syncDocumentLanguage } from "@/lib/supabase/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  const language = useAppLanguage();

  useEffect(() => {
    syncDocumentLanguage(language);
  }, [language]);

  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseProvider>
        <FiltersProvider>{children}</FiltersProvider>
      </SupabaseProvider>
    </QueryClientProvider>
  );
}
