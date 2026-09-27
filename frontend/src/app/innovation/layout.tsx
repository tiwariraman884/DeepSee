import type { ReactNode } from "react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "Innovation",
  description:
    "Explore DeepSea Guardian's cutting-edge capabilities: digital-twin ocean, time machine, emergency response and more.",
  path: "/innovation",
});

export default function InnovationLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
