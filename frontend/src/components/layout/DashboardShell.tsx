import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar, MobileNav } from "@/components/layout/Topbar";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { FloatingAssistant } from "@/components/ai/FloatingAssistant";

export function DashboardShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} subtitle={subtitle} />
        <MobileNav />
        <main id="main-content" tabIndex={-1} className="flex-1 p-4 pb-20 sm:p-6 sm:pb-6 focus:outline-none">
          <div className="mx-auto w-full max-w-[1440px] 2xl:px-6">{children}</div>
        </main>
      </div>
      <FloatingAssistant />
      <BottomTabBar />
    </div>
  );
}
