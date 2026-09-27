import type { ReactNode } from "react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "Settings",
  description: "Manage your DeepSea Guardian account, preferences and notifications.",
  path: "/settings",
});

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
