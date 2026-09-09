"use client";

import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface DashboardKpiCardProps {
  label: string;
  value: React.ReactNode;
  subText?: React.ReactNode;
  icon: React.ElementType;
  /** Hex or CSS color string, e.g. "#10B981" or "var(--brand-primary)" */
  color: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  onClick?: () => void;
  className?: string;
}

export function DashboardKpiCard({
  label,
  value,
  subText,
  icon: Icon,
  color,
  trend,
  trendLabel,
  onClick,
  className = "",
}: DashboardKpiCardProps) {
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up"
      ? "var(--status-success)"
      : trend === "down"
      ? "var(--status-danger)"
      : "var(--text-tertiary)";

  return (
    <div
      className={`glass-card ${className}`}
      onClick={onClick}
      style={{
        padding: "1.375rem 1.5rem",
        borderLeft: `3px solid ${color}`,
        cursor: onClick ? "pointer" : "default",
        transition: "transform 0.18s ease, box-shadow 0.18s ease",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
          (e.currentTarget as HTMLElement).style.boxShadow =
            "var(--shadow-lg)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLElement).style.boxShadow = "";
      }}
    >
      {/* Subtle background glow */}
      <div
        style={{
          position: "absolute",
          top: "-20px",
          right: "-20px",
          width: "100px",
          height: "100px",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${color}18 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "0.875rem",
        }}
      >
        <span
          style={{
            fontSize: "var(--text-xs)",
            fontWeight: 700,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {label}
        </span>
        <div
          style={{
            padding: "0.5rem",
            borderRadius: "var(--radius-md)",
            background: `${color}18`,
            color: color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={18} />
        </div>
      </div>

      <div
        style={{
          fontSize: "1.875rem",
          fontWeight: 800,
          color: "var(--text-primary)",
          letterSpacing: "-0.02em",
          lineHeight: 1,
          marginBottom: "0.625rem",
        }}
      >
        {value ?? "—"}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          fontSize: "var(--text-xs)",
          minHeight: "1rem",
        }}
      >
        {trend && trendLabel && (
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.2rem",
              color: trendColor,
              fontWeight: 700,
            }}
          >
            <TrendIcon size={12} />
            {trendLabel}
          </span>
        )}
        {subText && (
          <span style={{ color: "var(--text-secondary)" }}>{subText}</span>
        )}
      </div>
    </div>
  );
}
