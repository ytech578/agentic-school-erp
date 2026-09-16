"use client";

import React, { useState } from "react";
import { Printer, X, Copy, Check, ShieldAlert, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

interface MTSSInterventionPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  planData: {
    plan: string;
    studentName: string;
    admissionNumber: string;
  } | null;
  schoolName?: string;
}

export default function MTSSInterventionPlanModal({
  isOpen,
  onClose,
  planData,
  schoolName = "Sunrise Public School",
}: MTSSInterventionPlanModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !planData) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(planData.plan);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-mtss-plan, #printable-mtss-plan * {
            visibility: visible !important;
          }
          #printable-mtss-plan {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #FFFFFF !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div
        style={{
          background: "var(--bg-surface)",
          borderRadius: "var(--radius-2xl)",
          width: "100%",
          maxWidth: "880px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
          border: "1px solid var(--border-default)",
          overflow: "hidden",
        }}
      >
        {/* Modal Top Bar */}
        <div
          className="no-print"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "1rem 1.5rem",
            borderBottom: "1px solid var(--border-default)",
            background: "var(--bg-app)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div
              style={{
                padding: "0.4rem",
                borderRadius: "var(--radius-md)",
                background: "rgba(239, 68, 68, 0.12)",
                color: "var(--status-danger)",
              }}
            >
              <ShieldAlert size={18} />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: "var(--text-base)",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                MTSS Tiered Intervention Plan
              </h3>
              <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                {planData.studentName} • {planData.admissionNumber}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopy}
              style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}
            >
              {copied ? <Check size={14} color="var(--status-success)" /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy Plan"}
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
              }}
            >
              <Printer size={14} />
              Print Official Plan
            </Button>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--text-secondary)",
                padding: "0.35rem",
                borderRadius: "var(--radius-md)",
              }}
              title="Close modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Plan Content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "2rem",
            background: "var(--bg-app)",
          }}
        >
          <div
            id="printable-mtss-plan"
            style={{
              background: "#FFFFFF",
              color: "#1E293B",
              padding: "2.5rem",
              borderRadius: "var(--radius-xl)",
              border: "1px solid #CBD5E1",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
              lineHeight: 1.6,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "2px solid #0F172A",
                paddingBottom: "1rem",
                marginBottom: "1.5rem",
              }}
            >
              <div>
                <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0F172A", textTransform: "uppercase" }}>
                  {schoolName}
                </div>
                <div style={{ fontSize: "0.85rem", color: "#64748B", fontWeight: 600 }}>
                  Student Support & Retention Committee • Academic Session 2026-27
                </div>
              </div>
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#DC2626",
                  padding: "0.35rem 0.85rem",
                  borderRadius: "2rem",
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                Confidential • MTSS Tiered Support
              </div>
            </div>

            <div
              className="prose"
              style={{
                fontSize: "0.925rem",
                color: "#1E293B",
              }}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
              >
                {planData.plan}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
