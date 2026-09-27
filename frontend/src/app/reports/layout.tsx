import type { ReactNode } from "react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "Reports & Analytics",
  description:
    "Weekly, environmental, ocean-health and species reports with downloadable analytics from DeepSea Guardian.",
  path: "/reports",
});

export default function ReportsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
