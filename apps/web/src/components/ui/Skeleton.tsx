import React from "react";

export function Skeleton({
  className = "",
  style = {},
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`skeleton ${className}`}
      style={style}
    />
  );
}

export function DashboardLoadingSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-fade-in">
      <div
        className="skeleton"
        style={{
          height: "180px",
          borderRadius: "var(--radius-2xl)",
          border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.05))",
        }}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "1.25rem",
        }}
      >
        {Array(4)
          .fill(0)
          .map((_, i) => (
            <div
              key={i}
              className="skeleton"
              style={{
                height: "130px",
                borderRadius: "var(--radius-xl)",
                border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.05))",
              }}
            />
          ))}
      </div>
    </div>
  );
}
