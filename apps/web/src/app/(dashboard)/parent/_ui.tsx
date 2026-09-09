import React from "react";

export const Sk = ({ w = "100%", h = "1rem", r = "0.375rem", style }: { w?: string; h?: string; r?: string; style?: React.CSSProperties }) => (
  <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", ...style }} />
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

export { formatCurrencyINR as fmt, formatDate as fmtDate } from "@/lib/formatters";
export const statusColor = (s: string) => {
  if (s === "PRESENT") return { color: "var(--success)", bg: "var(--success-light)" };
  if (s === "ABSENT") return { color: "var(--danger)", bg: "var(--danger-light)" };
  if (s === "LATE") return { color: "var(--warning)", bg: "var(--warning-light)" };
  return { color: "var(--text-secondary)", bg: "var(--bg-surface-hover)" };
};
