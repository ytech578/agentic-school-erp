import React from "react";

// ─── Shared StatCard ─────────────────────────────────────────────────────────
// Used by hr, reports, staff, students, and dashboard overview pages.

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ElementType;
  color?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color = "var(--brand-blue)",
  className = "",
}: StatCardProps) {
  return (
    <div
      className={`stat-card-premium ${className}`}
      style={{
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div
        className="stat-icon-wrapper"
        style={{
          background: `${color}18`,
        }}
      >
        <Icon size={22} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "0.25rem", fontWeight: 500 }}>
          {label}
        </p>
        <p style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.1, margin: 0 }}>
          {value}
        </p>
        {sub && (
          <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "0.35rem", lineHeight: 1.3 }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Shared Badge ─────────────────────────────────────────────────────────────
interface BadgeProps {
  children: React.ReactNode;
  color?: "green" | "red" | "yellow" | "blue" | "gray" | "purple";
  className?: string;
}

const BADGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  green:  { bg: "var(--success-light, #f0fdf4)", text: "var(--success-dark, #166534)", border: "rgba(16, 185, 129, 0.2)" },
  red:    { bg: "var(--danger-light, #fef2f2)", text: "var(--danger-dark, #991b1b)", border: "rgba(239, 68, 68, 0.2)" },
  yellow: { bg: "var(--warning-light, #fefce8)", text: "var(--warning-dark, #854d0e)", border: "rgba(245, 158, 11, 0.2)" },
  blue:   { bg: "var(--brand-blue-subtle, #eff6ff)", text: "var(--brand-blue, #1d4ed8)", border: "rgba(37, 99, 235, 0.2)" },
  purple: { bg: "rgba(109, 40, 217, 0.1)", text: "#6d28d9", border: "rgba(109, 40, 217, 0.2)" },
  gray:   { bg: "var(--bg-app)", text: "var(--text-secondary)", border: "var(--border-default)" },
};

export function Badge({ children, color = "blue", className = "" }: BadgeProps) {
  const c = BADGE_COLORS[color] || BADGE_COLORS.blue;
  return (
    <span
      className={`inline-badge ${className}`}
      style={{
        padding: "0.2rem 0.625rem",
        borderRadius: "var(--radius-full)",
        fontSize: "0.75rem",
        fontWeight: 600,
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3rem",
        transition: "transform 0.15s ease",
      }}
    >
      {children}
    </span>
  );
}
