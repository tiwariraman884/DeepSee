import type { ReactNode } from "react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "Drone Command Center",
  description:
    "Live drone tracking, battery monitoring and mission visualization for autonomous ocean-surveillance drones.",
  path: "/drones",
});

export default function DronesLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
