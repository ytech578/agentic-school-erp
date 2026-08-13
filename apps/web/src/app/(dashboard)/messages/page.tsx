"use client";

import { MessageSquareOff } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function MessagesStubPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", height: "100%" }}>
      <div>
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)", marginBottom: "0.25rem" }}>Messages</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>Communication center</p>
      </div>

      <div style={{ 
        flex: 1, 
        display: "flex", 
        flexDirection: "column", 
        alignItems: "center", 
        justifyContent: "center",
        background: "var(--bg-surface)", 
        borderRadius: "var(--radius-lg)", 
        border: "1px dashed var(--border-default)",
        padding: "3rem",
        textAlign: "center"
      }}>
        <div style={{ 
          width: "80px", 
          height: "80px", 
          borderRadius: "50%", 
          background: "var(--bg-elevated)", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          marginBottom: "1.5rem",
          boxShadow: "var(--shadow-sm)"
        }}>
          <MessageSquareOff size={40} style={{ color: "var(--text-tertiary)" }} />
        </div>
        
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-semibold)", marginBottom: "0.5rem" }}>
          Message Center Coming in Phase 2
        </h2>
        <p style={{ color: "var(--text-secondary)", maxWidth: "400px", marginBottom: "2rem", lineHeight: 1.5 }}>
          The communication module will allow direct messaging between staff, teachers, and parents, including announcements and class groups.
        </p>
        
        <div style={{ display: "flex", gap: "1rem", opacity: 0.5, pointerEvents: "none" }}>
          <Button variant="outline">Compose Message</Button>
          <Button variant="outline">View Announcements</Button>
        </div>
      </div>
    </div>
  );
}
