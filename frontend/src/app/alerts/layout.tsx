import type { ReactNode } from "react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "Alerts & Notifications",
  description:
    "Critical, warning and informational ocean-monitoring alerts across all monitored zones from DeepSea Guardian.",
  path: "/alerts",
});

export default function AlertsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
