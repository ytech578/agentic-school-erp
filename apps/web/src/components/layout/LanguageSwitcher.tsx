"use client";

import { useEffect } from "react";
import { Languages, Check, Loader2 } from "lucide-react";
import { useLocaleStore, SupportedLocale } from "@/store/locale.store";

const LANGUAGES: { code: SupportedLocale; label: string; nativeLabel: string }[] = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
];

export default function LanguageSwitcher() {
  const { locale, isLoading, loadLocale } = useLocaleStore();

  // Hydrate locale from localStorage on first render (SSR-safe)
  useEffect(() => {
    const saved = localStorage.getItem("erp_locale") as SupportedLocale | null;
    if (saved && saved !== locale) {
      loadLocale(saved);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    loadLocale(e.target.value as SupportedLocale);
  };

  const currentLang = LANGUAGES.find((l) => l.code === locale) ?? LANGUAGES[0];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.35rem",
        padding: "0.3rem 0.6rem",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-default)",
        background: "var(--bg-surface)",
        cursor: "pointer",
        position: "relative",
      }}
      title="Switch Language / भाषा बदलें"
    >
      {/* Globe / Languages icon */}
      {isLoading ? (
        <Loader2 size={15} style={{ color: "var(--primary-600)", animation: "spin 1s linear infinite" }} />
      ) : (
        <Languages size={15} style={{ color: "var(--primary-600)", flexShrink: 0 }} />
      )}

      {/* Native label — visible only when not loading */}
      {!isLoading && (
        <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", userSelect: "none", pointerEvents: "none" }}>
          {currentLang.nativeLabel}
        </span>
      )}

      {/* Invisible native <select> overlaid on top — gives real browser UX, works everywhere */}
      <select
        value={locale}
        onChange={handleChange}
        disabled={isLoading}
        aria-label="Select language"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0,
          cursor: "pointer",
          fontSize: "1rem",
        }}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.nativeLabel} — {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}
