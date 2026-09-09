"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/store/theme.store";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const setTheme = useThemeStore((state) => state.setTheme);

  useEffect(() => {
    // Sync the Zustand store with the actual theme in localStorage upon hydration
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme === "dark" || storedTheme === "light") {
      setTheme(storedTheme);
    }
  }, [setTheme]);

  return <>{children}</>;
}
