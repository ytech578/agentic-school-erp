import React from "react";

export function UserAvatar({ name, size = 38 }: { name: string; size?: number }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";
  const colors = ["#4f46e5", "#2563eb", "#0284c7", "#059669", "#d97706", "#db2777", "#7c3aed"];
  const charCode = (name.charCodeAt(0) || 0) + (name.charCodeAt(name.length - 1) || 0);
  const color = colors[charCode % colors.length];

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: Math.max(11, size * 0.36),
        flexShrink: 0,
        border: "1px solid rgba(255, 255, 255, 0.15)",
        boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
      }}
    >
      {initials}
    </div>
  );
}
