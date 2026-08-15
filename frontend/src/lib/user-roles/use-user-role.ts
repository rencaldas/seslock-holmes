import { useQuery } from "@tanstack/react-query";
import { useSupabase } from "@/lib/supabase/context";
import { fetchCurrentUserRole } from "@/lib/user-roles/queries";

// UX only — a policy no banco (ver 20260814090000_user_roles_rbac.sql) é a
// aplicação real. Nunca usar este hook para decidir se uma chamada é segura,
// só para esconder/mostrar controles que, sem RBAC no servidor, dariam 403.
export function useUserRole() {
  const supabase = useSupabase();
  const userId = supabase.session?.user.id ?? null;

  const query = useQuery({
    queryKey: ["user-role", userId],
    enabled: Boolean(supabase.client && userId),
    queryFn: () => fetchCurrentUserRole(supabase.client!),
    // O papel de alguém não muda no meio de uma sessão sem uma ação
    // administrativa explícita fora do app — não vale reconsultar a cada
    // foco de janela.
    staleTime: 5 * 60 * 1000,
  });

  return {
    // Enquanto carrega, assume manager: melhor mostrar um botão que pode dar
    // 403 (raro, corrigido pela RLS) do que esconder ações de quem sempre
    // teve acesso enquanto a primeira consulta ainda não voltou.
    role: query.data ?? "manager",
    isLoading: query.isLoading,
  };
}
