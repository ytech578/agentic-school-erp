import { ReactNode } from "react";
import { SearchX } from "lucide-react";

export function EmptyState({ 
  icon: Icon = SearchX, 
  title, 
  description, 
  action 
}: { 
  icon?: any; 
  title: string; 
  description: string; 
  action?: ReactNode 
}) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "4rem 2rem", textAlign: "center", background: "var(--bg-surface)",
      borderRadius: "var(--radius-lg)", border: "1px dashed var(--border-default)"
    }}>
      <div style={{
        width: "64px", height: "64px", borderRadius: "50%", background: "var(--bg-elevated)",
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.5rem"
      }}>
        <Icon size={32} color="var(--text-tertiary)" />
      </div>
      <h3 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)", marginBottom: "0.5rem" }}>
        {title}
      </h3>
      <p style={{ color: "var(--text-secondary)", maxWidth: "400px", marginBottom: "1.5rem", lineHeight: 1.5 }}>
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
