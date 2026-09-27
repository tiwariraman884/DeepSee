import type { ReactNode } from "react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "Species & Biodiversity",
  description:
    "Monitor tracked marine species, population trends, habitat mapping and conservation status with AI-driven insights.",
  path: "/species",
});

export default function SpeciesLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
