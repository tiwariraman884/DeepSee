import type { ReactNode } from "react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "Login",
  description: "Sign in to DeepSea Guardian to access your ocean monitoring mission control.",
  path: "/login",
});

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
