import React from "react";

// ─── Shared StatCard ─────────────────────────────────────────────────────────
// Used by hr/page.tsx, reports/page.tsx, and other module pages.

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ElementType;
  color?: string;
}

export function StatCard({ label, value, sub, icon: Icon, color = "var(--brand-primary)" }: StatCardProps) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        borderRadius: "var(--radius-lg)",
        padding: "1.25rem 1.5rem",
        border: "1px solid var(--border-default)",
        display: "flex",
        alignItems: "flex-start",
        gap: "1rem",
        borderLeft: `3px solid ${color}`,
        transition: "transform 0.15s ease",
      }}
    >
      <div
        style={{
          padding: "0.75rem",
          borderRadius: "var(--radius-md)",
          background: `${color}18`,
          flexShrink: 0,
        }}
      >
        <Icon size={22} color={color} />
      </div>
      <div>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "0.15rem" }}>{label}</p>
        <p style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>{value}</p>
        {sub && <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "0.25rem" }}>{sub}</p>}
      </div>
    </div>
  );
}

// ─── Shared Badge ─────────────────────────────────────────────────────────────
interface BadgeProps {
  children: React.ReactNode;
  color?: "green" | "red" | "yellow" | "blue" | "gray" | "purple";
}

const BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  green:  { bg: "#f0fdf4", text: "#166534" },
  red:    { bg: "#fef2f2", text: "#991b1b" },
  yellow: { bg: "#fefce8", text: "#854d0e" },
  blue:   { bg: "#eff6ff", text: "#1d4ed8" },
  purple: { bg: "#f5f3ff", text: "#6d28d9" },
  gray:   { bg: "var(--bg-app)", text: "var(--text-secondary)" },
};

export function Badge({ children, color = "blue" }: BadgeProps) {
  const c = BADGE_COLORS[color] || BADGE_COLORS.blue;
  return (
    <span
      style={{
        padding: "0.2rem 0.625rem",
        borderRadius: "var(--radius-full)",
        fontSize: "0.75rem",
        fontWeight: 600,
        background: c.bg,
        color: c.text,
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      {children}
    </span>
  );
}
