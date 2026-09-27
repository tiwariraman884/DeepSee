import type { ReactNode } from "react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "Interactive Ocean Map",
  description:
    "Explore pollution heatmaps, sensor locations, drone tracking and AI risk zones across the world's oceans on an interactive map.",
  path: "/map",
});

export default function MapLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
