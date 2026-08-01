import { useEffect, type ReactNode } from "react";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SupabaseProvider } from "@/lib/supabase/context";
import { FiltersProvider } from "@/lib/filters/filters-context";
import { useAppLanguage } from "@/lib/i18n/use-i18n";
import { isPermissionDeniedError, notifyAuthRequired } from "@/lib/supabase/auth";
import { syncDocumentLanguage } from "@/lib/supabase/settings";

const queryClient = new QueryClient({
  // Detectar a recusa por permissão num ponto só, no cache, evita espalhar a
  // checagem por cada página: qualquer consulta que bata na RLS levanta a tela
  // de login, inclusive as que forem escritas depois.
  queryCache: new QueryCache({
    onError: (error) => {
      if (isPermissionDeniedError(error)) {
        notifyAuthRequired();
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Repetir uma recusa por permissão só atrasa a tela de login — a
      // resposta não vai mudar sem uma sessão.
      retry: (failureCount, error) => !isPermissionDeniedError(error) && failureCount < 1,
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
