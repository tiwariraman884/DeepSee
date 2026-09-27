"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentPropsWithRef } from "react";

export function ThemeProvider({ children, ...props }: ComponentPropsWithRef<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
