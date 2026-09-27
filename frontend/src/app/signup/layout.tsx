import type { ReactNode } from "react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "Sign Up",
  description: "Create a DeepSea Guardian account to access AI-powered ocean monitoring.",
  path: "/signup",
});

export default function SignupLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
