import type { ReactNode } from "react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "Pollution Monitoring",
  description:
    "Track marine pollution events — plastics, oil spills, ghost nets and illegal dumping — with severity, AI confidence and trends.",
  path: "/pollution",
});

export default function PollutionLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
