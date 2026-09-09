"use client";

import { useThemeStore } from "@/store/theme.store";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <button className="btn-ghost btn-icon" style={{ opacity: 0 }}><Sun size={20} /></button>;
  }

  return (
    <button 
      onClick={toggleTheme}
      className="btn-ghost btn-icon"
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      style={{ color: 'var(--text-secondary)' }}
    >
      {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
    </button>
  );
}
