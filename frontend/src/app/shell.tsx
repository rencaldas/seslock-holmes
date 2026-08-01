import { Outlet, useLocation } from "react-router-dom";
import { AppFrame } from "@/components/shell/app-frame";
import { LoginState } from "@/components/states/login-state";
import { SupabaseRequiredState } from "@/components/states/supabase-required-state";
import { useSupabase } from "@/lib/supabase/context";

const ROUTES_WITHOUT_SUPABASE = ["/settings", "/faq"];

export function AppShell() {
  const supabase = useSupabase();
  const location = useLocation();
  const requiresSupabase = !ROUTES_WITHOUT_SUPABASE.includes(location.pathname);

  // Ordem importa: sem credenciais não há como nem tentar autenticar, então a
  // tela de configuração vem primeiro. O login só entra quando uma consulta
  // já foi recusada por permissão e ainda não existe sessão — Configurações e
  // FAQ seguem acessíveis para quem precisa trocar de projeto sem ter conta.
  const requiresLogin = supabase.authRequired && !supabase.session && requiresSupabase;

  return (
    <AppFrame>
      {!supabase.ready && requiresSupabase ? (
        <SupabaseRequiredState />
      ) : requiresLogin ? (
        <LoginState />
      ) : (
        <Outlet />
      )}
    </AppFrame>
  );
}
