import type { ReactNode } from "react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "Risk Prediction Engine",
  description:
    "Forecast coral bleaching, biodiversity loss and pollution expansion with the DeepSea Guardian AI risk engine.",
  path: "/risk",
});

export default function RiskLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
