"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  FileText,
  Users,
  ExternalLink,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { apiClient } from "@/lib/axios";

export interface PeerMatchDetail {
  peerSubmissionId: string;
  peerStudentId: string;
  peerStudentName?: string;
  similarityScore: number; // 0 to 100
  matchedPhrases: string[];
}

export interface OriginalityReport {
  overallSimilarityScore: number; // 0 to 100
  status: "CLEAN" | "ACCEPTABLE" | "MODERATE_SIMILARITY" | "HIGH_SIMILARITY" | "FLAGGED_PLAGIARISM";
  isPlagiarized: boolean;
  highestMatchPercentage: number;
  peerMatches: PeerMatchDetail[];
  wordCount: number;
  evaluatedAt: string;
  summary: string;
}

export interface AssignmentPlagiarismModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignmentId: string;
  assignmentTitle: string;
  studentId: string;
  studentName: string;
  submissionText: string;
  attachmentUrl?: string | null;
  originalityReport: OriginalityReport | null;
  peerSubmissions?: Array<{
    studentId: string;
    studentName: string;
    content: string;
  }>;
  onReportUpdated?: (newReport: OriginalityReport) => void;
}

export default function AssignmentPlagiarismModal({
  isOpen,
  onClose,
  assignmentId,
  assignmentTitle,
  studentId,
  studentName,
  submissionText,
  attachmentUrl,
  originalityReport: initialReport,
  peerSubmissions = [],
  onReportUpdated,
}: AssignmentPlagiarismModalProps) {
  const [report, setReport] = useState<OriginalityReport | null>(initialReport);
  const [reChecking, setReChecking] = useState(false);
  const [selectedPeerId, setSelectedPeerId] = useState<string>("");
  const [highlightMatches, setHighlightMatches] = useState(true);
  const [copiedPhrase, setCopiedPhrase] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Sync state if initialReport changes
  React.useEffect(() => {
    setReport(initialReport);
  }, [initialReport]);

  const peerMatches = report?.peerMatches || [];

  // Set default selected peer when report is available
  React.useEffect(() => {
    if (peerMatches.length > 0 && !selectedPeerId) {
      setSelectedPeerId(peerMatches[0].peerStudentId);
    }
  }, [peerMatches, selectedPeerId]);

  const currentPeer = useMemo(() => {
    if (!selectedPeerId && peerMatches.length > 0) {
      return peerMatches[0];
    }
    return peerMatches.find((p) => p.peerStudentId === selectedPeerId) || peerMatches[0] || null;
  }, [peerMatches, selectedPeerId]);

  // Find the peer's actual full text from peerSubmissions roster
  const currentPeerFullText = useMemo(() => {
    if (!currentPeer) return "";
    const matchedRosterItem = peerSubmissions.find((p) => p.studentId === currentPeer.peerStudentId);
    if (matchedRosterItem?.content) return matchedRosterItem.content;
    return currentPeer.matchedPhrases?.length > 0
      ? currentPeer.matchedPhrases.join("\n\n")
      : "Peer submission content recorded in database.";
  }, [currentPeer, peerSubmissions]);

  if (!isOpen) return null;

  // Re-run live plagiarism check via API
  const handleRecheckPlagiarism = async () => {
    setReChecking(true);
    setActionNotice(null);
    try {
      const res = await apiClient.post(
        `/assignments/${assignmentId}/submissions/${studentId}/plagiarism-check`
      );
      const newReport: OriginalityReport = res.data?.data || res.data;
      setReport(newReport);
      if (onReportUpdated) {
        onReportUpdated(newReport);
      }
      setActionNotice("Originality audit recalculated successfully against all classmate submissions.");
    } catch (err: any) {
      console.error("Failed to run plagiarism check:", err);
      setActionNotice(err?.response?.data?.message || "Failed to recalculate plagiarism report.");
    } finally {
      setReChecking(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPhrase(text);
    setTimeout(() => setCopiedPhrase(null), 2000);
  };

  // Helper to render text with highlighted matching phrases
  const renderHighlightedText = (text: string, phrases: string[], highlightColor: string) => {
    if (!text) {
      return <span style={{ color: "var(--text-tertiary)", fontStyle: "italic" }}>No written text provided in this submission.</span>;
    }
    if (!highlightMatches || !phrases || phrases.length === 0) {
      return <span>{text}</span>;
    }

    const cleanPhrases = phrases.filter((p) => p && p.trim().length > 3);
    if (cleanPhrases.length === 0) {
      return <span>{text}</span>;
    }

    try {
      const escaped = cleanPhrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      const regex = new RegExp(`(${escaped.join("|")})`, "gi");
      const parts = text.split(regex);

      return (
        <span>
          {parts.map((part, i) => {
            const isMatch = cleanPhrases.some((p) => p.toLowerCase() === part.toLowerCase());
            if (isMatch) {
              return (
                <mark
                  key={i}
                  style={{
                    background: highlightColor,
                    color: "inherit",
                    padding: "0.1rem 0.25rem",
                    borderRadius: "3px",
                    fontWeight: 600,
                    borderBottom: "2px solid #ef4444",
                  }}
                >
                  {part}
                </mark>
              );
            }
            return <span key={i}>{part}</span>;
          })}
        </span>
      );
    } catch {
      return <span>{text}</span>;
    }
  };

  const score = report?.overallSimilarityScore ?? 0;
  const status = report?.status ?? (score >= 50 ? "FLAGGED_PLAGIARISM" : score >= 20 ? "MODERATE_SIMILARITY" : "CLEAN");

  const getStatusBadge = () => {
    switch (status) {
      case "FLAGGED_PLAGIARISM":
        return {
          label: "Severe Collision Detected",
          bg: "rgba(239, 68, 68, 0.15)",
          color: "#dc2626",
          border: "rgba(239, 68, 68, 0.3)",
          icon: ShieldAlert,
        };
      case "HIGH_SIMILARITY":
        return {
          label: "High Similarity Alert",
          bg: "rgba(249, 115, 22, 0.15)",
          color: "#ea580c",
          border: "rgba(249, 115, 22, 0.3)",
          icon: AlertTriangle,
        };
      case "MODERATE_SIMILARITY":
        return {
          label: "Moderate Phrasing Overlap",
          bg: "rgba(245, 158, 11, 0.15)",
          color: "#d97706",
          border: "rgba(245, 158, 11, 0.3)",
          icon: AlertTriangle,
        };
      case "ACCEPTABLE":
        return {
          label: "Acceptable Common Margin",
          bg: "rgba(14, 165, 233, 0.15)",
          color: "#0284c7",
          border: "rgba(14, 165, 233, 0.3)",
          icon: Info,
        };
      case "CLEAN":
      default:
        return {
          label: "100% Original (Clean)",
          bg: "rgba(16, 185, 129, 0.15)",
          color: "#059669",
          border: "rgba(16, 185, 129, 0.3)",
          icon: ShieldCheck,
        };
    }
  };

  const badgeInfo = getStatusBadge();
  const StatusIcon = badgeInfo.icon;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg-overlay)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        animation: "fadeIn 0.25s ease-out",
      }}
    >
      <div
        style={{
          background: "var(--bg-surface-solid)",
          backgroundColor: "var(--bg-surface-solid)",
          borderRadius: "var(--radius-2xl)",
          border: "1px solid var(--border-default)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          maxWidth: "76rem",
          width: "100%",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "zoomIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* ========================================================
            PANEL HEADER
            ======================================================== */}
        <div
          style={{
            padding: "1.25rem 1.75rem",
            borderBottom: "1px solid var(--border-default)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-surface-solid) 100%)",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                background: badgeInfo.bg,
                color: badgeInfo.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1px solid ${badgeInfo.border}`,
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <StatusIcon size={24} />
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
                  Originality Sentinel — {studentName}
                </h2>
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    padding: "0.2rem 0.6rem",
                    borderRadius: "100px",
                    background: badgeInfo.bg,
                    color: badgeInfo.color,
                    border: `1px solid ${badgeInfo.border}`,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.3rem",
                  }}
                >
                  <StatusIcon size={12} />
                  {badgeInfo.label}
                </span>
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                Assignment: <strong>{assignmentTitle}</strong> · Word Count: <strong>{report?.wordCount || submissionText.trim().split(/\s+/).filter(Boolean).length} words</strong>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <Button
              size="sm"
              variant="outline"
              disabled={reChecking || !submissionText.trim()}
              onClick={handleRecheckPlagiarism}
              icon={<RefreshCw size={14} className={reChecking ? "animate-spin" : ""} />}
            >
              {reChecking ? "Auditing Peers..." : "Re-Run AI Plagiarism Check"}
            </Button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--text-tertiary)",
                padding: "0.4rem",
                borderRadius: "var(--radius-md)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Close Panel"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Action Notice Banner if updated */}
        {actionNotice && (
          <div
            style={{
              padding: "0.6rem 1.75rem",
              background: "rgba(16, 185, 129, 0.1)",
              borderBottom: "1px solid rgba(16, 185, 129, 0.2)",
              color: "var(--success)",
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <Check size={14} />
            {actionNotice}
          </div>
        )}

        {/* ========================================================
            KEY METRICS & CONTROLS STRIP
            ======================================================== */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "0.75rem",
            padding: "0.85rem 1.75rem",
            background: "var(--bg-app)",
            borderBottom: "1px solid var(--border-default)",
            alignItems: "center",
          }}
        >
          {/* Metric 1: Overall Similarity */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: badgeInfo.bg,
                color: badgeInfo.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: "1rem",
                border: `2px solid ${badgeInfo.color}`,
              }}
            >
              {score}%
            </div>
            <div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 600 }}>
                SIMILARITY INDEX
              </div>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 800, color: "var(--text-primary)" }}>
                {100 - score}% Unique Content
              </div>
            </div>
          </div>

          {/* Metric 2: Top Colliding Student */}
          <div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 600 }}>
              HIGHEST PEER COLLISION
            </div>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 800, color: currentPeer ? badgeInfo.color : "var(--text-primary)" }}>
              {currentPeer ? `${currentPeer.peerStudentName || "Classmate"} (${currentPeer.similarityScore}%)` : "Zero Collisions"}
            </div>
          </div>

          {/* Metric 3: Total Peer Comparisons */}
          <div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 600 }}>
              PEERS AUDITED
            </div>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 800, color: "var(--text-primary)" }}>
              {peerSubmissions.length > 0 ? `${peerSubmissions.length} Class Submissions` : "Entire Active Class"}
            </div>
          </div>

          {/* Control: Highlight Toggle */}
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.5rem" }}>
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                color: "var(--text-secondary)",
                cursor: "pointer",
                background: "var(--bg-surface)",
                padding: "0.35rem 0.65rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-default)",
              }}
            >
              <input
                type="checkbox"
                checked={highlightMatches}
                onChange={(e) => setHighlightMatches(e.target.checked)}
                style={{ cursor: "pointer" }}
              />
              Highlight Overlaps
            </label>
          </div>
        </div>

        {/* ========================================================
            SIDE-BY-SIDE INTERACTIVE SPLIT VIEW
            ======================================================== */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0",
            flex: 1,
            overflowY: "hidden",
            minHeight: "360px",
            borderBottom: "1px solid var(--border-default)",
          }}
        >
          {/* ──────────────── LEFT PANE: STUDENT'S SUBMISSION ──────────────── */}
          <div
            style={{
              padding: "1.25rem 1.5rem",
              borderRight: "1px solid var(--border-default)",
              display: "flex",
              flexDirection: "column",
              background: "var(--bg-surface)",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.75rem",
                paddingBottom: "0.5rem",
                borderBottom: "1px solid var(--border-default)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <FileText size={16} className="text-secondary" />
                <span style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                  {studentName}&apos;s Submission
                </span>
                <span style={{ fontSize: "10px", fontWeight: 700, padding: "0.1rem 0.4rem", borderRadius: "100px", background: "var(--brand-blue-subtle)", color: "var(--brand-primary)" }}>
                  Target
                </span>
              </div>
              {attachmentUrl && (
                <a
                  href={attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--brand-primary)",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    fontWeight: 600,
                  }}
                >
                  Attachment <ExternalLink size={12} />
                </a>
              )}
            </div>

            <div
              style={{
                flex: 1,
                fontSize: "var(--text-sm)",
                lineHeight: 1.7,
                color: "var(--text-primary)",
                whiteSpace: "pre-wrap",
                background: "var(--bg-app)",
                padding: "1rem",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border-default)",
                fontFamily: "var(--font-mono, monospace)",
                overflowY: "auto",
              }}
            >
              {renderHighlightedText(
                submissionText,
                currentPeer?.matchedPhrases || [],
                "rgba(254, 240, 138, 0.85)"
              )}
            </div>
          </div>

          {/* ──────────────── RIGHT PANE: MATCHED PEER COMPARISON ──────────────── */}
          <div
            style={{
              padding: "1.25rem 1.5rem",
              display: "flex",
              flexDirection: "column",
              background: "var(--bg-surface)",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.75rem",
                paddingBottom: "0.5rem",
                borderBottom: "1px solid var(--border-default)",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Users size={16} className="text-secondary" />
                <span style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                  Peer Collision Source:
                </span>
              </div>

              {/* Peer Selector Dropdown if multiple peer collisions exist */}
              {peerMatches.length > 1 ? (
                <select
                  value={selectedPeerId}
                  onChange={(e) => setSelectedPeerId(e.target.value)}
                  style={{
                    padding: "0.25rem 0.5rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-default)",
                    fontSize: "var(--text-xs)",
                    fontWeight: 600,
                    background: "var(--bg-app)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                  }}
                >
                  {peerMatches.map((p) => (
                    <option key={p.peerStudentId} value={p.peerStudentId}>
                      {p.peerStudentName || "Peer"} ({p.similarityScore}% match)
                    </option>
                  ))}
                </select>
              ) : currentPeer ? (
                <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-primary)" }}>
                  {currentPeer.peerStudentName || "Classmate"} ({currentPeer.similarityScore}% match)
                </span>
              ) : (
                <span style={{ fontSize: "var(--text-xs)", color: "var(--success)", fontWeight: 700 }}>
                  No Collisions
                </span>
              )}
            </div>

            {currentPeer ? (
              <div
                style={{
                  flex: 1,
                  fontSize: "var(--text-sm)",
                  lineHeight: 1.7,
                  color: "var(--text-primary)",
                  whiteSpace: "pre-wrap",
                  background: "var(--bg-app)",
                  padding: "1rem",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--border-default)",
                  fontFamily: "var(--font-mono, monospace)",
                  overflowY: "auto",
                }}
              >
                {renderHighlightedText(
                  currentPeerFullText,
                  currentPeer.matchedPhrases || [],
                  "rgba(254, 215, 170, 0.85)"
                )}
              </div>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  background: "var(--bg-app)",
                  borderRadius: "var(--radius-lg)",
                  border: "1px dashed var(--border-default)",
                  padding: "2rem",
                  color: "var(--text-secondary)",
                }}
              >
                <ShieldCheck size={48} style={{ color: "var(--success)", marginBottom: "0.75rem", opacity: 0.8 }} />
                <h4 style={{ margin: 0, fontWeight: 800, color: "var(--text-primary)" }}>Original Work Certified</h4>
                <p style={{ margin: "0.5rem 0 0", fontSize: "var(--text-xs)", maxWidth: "320px", lineHeight: 1.5 }}>
                  This student&apos;s submission contains original formulation with zero detected overlap against other submissions in this class.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================
            VERBATIM MATCHES BREAKDOWN & EXCERPTS
            ======================================================== */}
        {currentPeer && currentPeer.matchedPhrases.length > 0 && (
          <div
            style={{
              padding: "1rem 1.75rem",
              background: "var(--bg-app)",
              borderBottom: "1px solid var(--border-default)",
              maxHeight: "140px",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Verbatim Matching Phrase Shingles ({currentPeer.matchedPhrases.length})
              </span>
              <span style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>
                (Exact sequence matches of 4+ words)
              </span>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {currentPeer.matchedPhrases.map((phrase, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => copyToClipboard(phrase)}
                  title="Click to copy phrase"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    padding: "0.25rem 0.55rem",
                    borderRadius: "var(--radius-md)",
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-default)",
                    fontSize: "0.75rem",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <mark style={{ background: "transparent", color: "inherit", fontWeight: 600 }}>&ldquo;{phrase}&rdquo;</mark>
                  {copiedPhrase === phrase ? <Check size={11} className="text-success" /> : <Copy size={11} className="text-secondary" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================
            SUMMARY NARRATIVE & TEACHER ACTIONS FOOTER
            ======================================================== */}
        <div
          style={{
            padding: "1rem 1.75rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--bg-surface-solid)",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: "280px" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 600, display: "block" }}>
              AI ORIGINALITY AUDIT SUMMARY
            </span>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-primary)", fontWeight: 500 }}>
              {report?.summary || "Clean submission. No significant peer collisions or copy patterns detected."}
            </span>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Button size="sm" variant="outline" onClick={onClose}>
              Close Inspector
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
