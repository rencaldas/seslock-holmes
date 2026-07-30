import { Outlet, useLocation } from "react-router-dom";
import { AppFrame } from "@/components/shell/app-frame";
import { SupabaseRequiredState } from "@/components/states/supabase-required-state";
import { useSupabase } from "@/lib/supabase/context";

const ROUTES_WITHOUT_SUPABASE = ["/settings", "/faq"];

export function AppShell() {
  const supabase = useSupabase();
  const location = useLocation();
  const requiresSupabase = !ROUTES_WITHOUT_SUPABASE.includes(location.pathname);

  return (
    <AppFrame>
      {!supabase.ready && requiresSupabase ? <SupabaseRequiredState /> : <Outlet />}
    </AppFrame>
  );
}
