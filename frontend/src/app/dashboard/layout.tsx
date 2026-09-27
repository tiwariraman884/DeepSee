import type { ReactNode } from "react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "Dashboard",
  description:
    "Real-time ocean health score, active drones, pollution hotspots, tracked species and sensor telemetry in one mission-control view.",
  path: "/dashboard",
});

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
