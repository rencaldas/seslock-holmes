import type { ReactNode } from "react";
import { AppFooter } from "@/components/shell/app-footer";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { useDisclosure } from "@/lib/hooks/use-disclosure";

export function AppFrame({ children }: { children: ReactNode }) {
  const { isOpen: mobileNavOpen, open: openMobileNav, close: closeMobileNav } = useDisclosure(false);

  return (
    <div className="flex min-h-screen bg-transparent">
      <Sidebar mobileOpen={mobileNavOpen} onCloseMobile={closeMobileNav} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar onOpenMobileNav={openMobileNav} />
        <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 pb-12 pt-6 sm:px-6 lg:px-10">{children}</main>
        <AppFooter />
      </div>
    </div>
  );
}
