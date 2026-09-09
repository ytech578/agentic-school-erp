"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Users, GraduationCap, DollarSign, X } from "lucide-react";
import { useRouter } from "next/navigation";

export default function GlobalSearch({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  // Mock static search results for MVP
  const results = [
    { type: "student", id: "1", title: "Aarav Sharma", subtitle: "Class 10A • Adm No: 2026001", icon: GraduationCap },
    { type: "student", id: "2", title: "Diya Patel", subtitle: "Class 12 Science • Adm No: 2024012", icon: GraduationCap },
    { type: "staff", id: "3", title: "Rahul Verma", subtitle: "Teacher • Mathematics", icon: Users },
    { type: "fee", id: "4", title: "Term 1 Tuition Fee", subtitle: "Amount: ₹12,000", icon: DollarSign },
  ].filter(r => query && (r.title.toLowerCase().includes(query.toLowerCase()) || r.subtitle.toLowerCase().includes(query.toLowerCase())));

  if (!isOpen) return null;

  return (
    <>
      <div 
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--bg-overlay)",
          zIndex: 1000,
          backdropFilter: "var(--modal-backdrop-blur)",
          WebkitBackdropFilter: "var(--modal-backdrop-blur)",
          animation: "fadeIn 0.2s ease-out",
        }}
        onClick={onClose}
      />
      <div style={{
        position: "fixed", top: "20%", left: "50%", transform: "translate(-50%, 0)", width: "100%", maxWidth: "560px",
        background: "var(--bg-surface-solid)", backgroundColor: "var(--bg-surface-solid)",
        borderRadius: "var(--radius-xl)", border: "1px solid var(--border-default)",
        boxShadow: "var(--modal-shadow)", zIndex: 1001,
        overflow: "hidden", animation: "zoomIn 0.2s ease-out", opacity: 1
      }}>
        <div style={{ display: "flex", alignItems: "center", padding: "1rem 1.5rem", borderBottom: "1px solid var(--border-default)" }}>
          <Search size={20} color="var(--text-tertiary)" style={{ marginRight: "1rem" }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search students, staff, fees..."
            style={{ flex: 1, border: "none", background: "transparent", color: "var(--text-primary)", fontSize: "var(--text-lg)", outline: "none" }}
          />
          <button onClick={onClose} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "4px", padding: "0.25rem 0.5rem", fontSize: "0.75rem", color: "var(--text-secondary)", cursor: "pointer" }}>ESC</button>
        </div>
        
        {query && (
          <div style={{ padding: "0.5rem", maxHeight: "400px", overflowY: "auto" }}>
            {results.length > 0 ? (
              results.map((r, i) => (
                <div key={i}
                  onClick={() => {
                    onClose();
                    if (r.type === "student") router.push(`/students`);
                    if (r.type === "staff") router.push(`/staff`);
                    if (r.type === "fee") router.push(`/fees`);
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: "1rem", padding: "0.75rem 1rem",
                    borderRadius: "var(--radius-md)", cursor: "pointer", transition: "background 0.1s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-active)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ width: "32px", height: "32px", borderRadius: "var(--radius-md)", background: "var(--bg-surface)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border-default)" }}>
                    <r.icon size={16} color="var(--text-secondary)" />
                  </div>
                  <div>
                    <div style={{ fontWeight: "var(--font-medium)", color: "var(--text-primary)", fontSize: "var(--text-sm)" }}>{r.title}</div>
                    <div style={{ color: "var(--text-secondary)", fontSize: "var(--text-xs)" }}>{r.subtitle}</div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-tertiary)" }}>
                No results found for "{query}"
              </div>
            )}
          </div>
        )}
        {!query && (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
            Type to start searching...
          </div>
        )}
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeInDown {
          from { opacity: 0; transform: translate(-50%, -10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}} />
    </>
  );
}
