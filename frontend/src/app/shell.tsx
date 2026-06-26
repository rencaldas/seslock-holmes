import { Outlet } from "react-router-dom";
import { AppFrame } from "@/components/shell/app-frame";

export function AppShell() {
  return (
    <AppFrame>
      <Outlet />
    </AppFrame>
  );
}
