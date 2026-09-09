"use client";
import React from "react";
import { Headphones, LifeBuoy, MessageSquare, Phone, HelpCircle } from "lucide-react";
import { Card, PageHeader } from "../_ui";

export default function SupportPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <PageHeader title="Support" subtitle="Get help or contact the administration" icon={<Headphones size={22} />} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
        {/* Support Options */}
        {[
          { icon: <LifeBuoy size={24} />, title: "Help Desk", desc: "Raise a ticket or get help", color: "var(--brand-blue)", bg: "var(--brand-blue-subtle)" },
          { icon: <HelpCircle size={24} />, title: "FAQ", desc: "Find answers to common questions", color: "var(--risk-low)", bg: "var(--risk-low-bg)" },
          { icon: <Phone size={24} />, title: "Contact School", desc: "Call or email school administration", color: "var(--risk-medium)", bg: "var(--risk-medium-bg)" },
        ].map(item => (
          <Card key={item.title} style={{ padding: "1.5rem", display: "flex", gap: "1.25rem", alignItems: "center", cursor: "pointer", transition: "transform 0.2s" }} onMouseEnter={(e: any) => e.currentTarget.style.transform = "translateY(-2px)"} onMouseLeave={(e: any) => e.currentTarget.style.transform = "translateY(0)"}>
            <div style={{ width: 56, height: 56, borderRadius: "1rem", background: item.bg, color: item.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {item.icon}
            </div>
            <div>
              <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "1.125rem", marginBottom: "0.25rem" }}>{item.title}</div>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>{item.desc}</div>
            </div>
            <div style={{ marginLeft: "auto", color: "var(--text-tertiary)" }}>→</div>
          </Card>
        ))}
      </div>

      <Card style={{ padding: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--risk-low-bg)", border: `1px solid var(--border-default)`, flexWrap: "wrap", gap: "1.5rem" }}>
        <div>
          <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.25rem", fontWeight: 800, color: "var(--risk-low)" }}>We are here to help you!</h3>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9375rem" }}>Our support team is available Mon-Fri, 8 AM to 5 PM.</p>
        </div>
        <button style={{ background: "var(--risk-low)", color: "var(--bg-surface)", padding: "0.75rem 1.5rem", borderRadius: "0.75rem", border: "none", fontWeight: 700, fontSize: "0.9375rem", cursor: "pointer" }}>
          Contact Us
        </button>
      </Card>
    </div>
  );
}
