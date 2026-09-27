import type { ReactNode } from "react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "AI Assistant",
  description:
    "Ask the DeepSea Guardian AI assistant about pollution, species, alerts and ocean health in natural language.",
  path: "/assistant",
});

export default function AssistantLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
