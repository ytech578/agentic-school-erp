export function Skeleton({ className = "", style = {} }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        background: "var(--bg-elevated)",
        borderRadius: "var(--radius-md)",
        animation: "shimmer 1.5s infinite",
        ...style
      }}
    />
  );
}
