import React from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrencyINR, formatDate, getAttendanceStatusBadge } from "@/lib/formatters";

export const Sk = ({ w = "100%", h = "1rem", r = "0.375rem", style }: { w?: string; h?: string; r?: string; style?: React.CSSProperties }) => (
  <Skeleton style={{ width: w, height: h, borderRadius: r, ...style }} />
);

export const Card = ({ children, style, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div style={{ background: "var(--bg-surface)", borderRadius: "1rem", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-sm)", ...style }} {...props}>{children}</div>
);

export const CardHeader = ({ title, action }: { title: string; action?: React.ReactNode }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-default)" }}>
    <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>{title}</h3>
    {action}
  </div>
);

export const Badge = ({ text, color = "var(--risk-low)", bg = "var(--risk-low-bg)" }: { text: string; color?: string; bg?: string }) => (
  <span style={{ display: "inline-block", background: bg, color, padding: "0.2rem 0.625rem", borderRadius: "2rem", fontSize: "0.7rem", fontWeight: 700, whiteSpace: "nowrap" }}>{text}</span>
);

export const PageHeader = ({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: React.ReactNode }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
    {icon && <div style={{ background: "var(--risk-low-bg)", color: "var(--risk-low)", padding: "0.75rem", borderRadius: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>}
    <div>
      <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)" }}>{title}</h1>
      {subtitle && <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)", fontSize: "0.875rem" }}>{subtitle}</p>}
    </div>
  </div>
);

export { formatCurrencyINR as fmt, formatDate as fmtDate };

export const statusColor = (s: string) => {
  const badge = getAttendanceStatusBadge(s);
  return { color: badge.color, bg: badge.bg };
};
