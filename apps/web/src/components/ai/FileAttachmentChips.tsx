"use client";

import React, { useRef } from "react";
import { Paperclip, X, FileText, Image as ImageIcon, FileSpreadsheet, Mic, Square } from "lucide-react";
export { VoiceWaveformBar } from "./VoiceWaveformBar";

export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  base64: string;
  previewUrl?: string;
}

interface FileAttachmentChipsProps {
  attachments: FileAttachment[];
  onRemoveAttachment: (id: string) => void;
  maxFiles?: number;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return <ImageIcon size={14} className="text-blue-500" />;
  }
  if (mimeType.includes("pdf")) {
    return <FileText size={14} className="text-rose-500" />;
  }
  if (mimeType.includes("csv") || mimeType.includes("sheet") || mimeType.includes("excel")) {
    return <FileSpreadsheet size={14} className="text-emerald-500" />;
  }
  return <FileText size={14} className="text-indigo-500" />;
}

export function FileAttachmentChips({
  attachments,
  onRemoveAttachment,
}: FileAttachmentChipsProps) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div style={{
      display: "flex",
      flexWrap: "wrap",
      gap: "0.5rem",
      padding: "0.5rem 0.25rem",
      animation: "chipPopIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
    }}>
      {attachments.map((att) => (
        <div
          key={att.id}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.3rem 0.65rem",
            borderRadius: "var(--radius-lg)",
            background: "rgba(99, 102, 241, 0.1)",
            border: "1px solid rgba(99, 102, 241, 0.25)",
            color: "var(--text-primary)",
            fontSize: "12px",
            fontWeight: 500,
            backdropFilter: "blur(8px)",
            boxShadow: "0 2px 6px rgba(0, 0, 0, 0.04)",
            transition: "all 0.15s ease",
          }}
        >
          {att.previewUrl ? (
            <img
              src={att.previewUrl}
              alt={att.name}
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "4px",
                objectFit: "cover",
              }}
            />
          ) : (
            getFileIcon(att.type)
          )}
          <span style={{
            maxWidth: "140px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {att.name}
          </span>
          <span style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>
            ({formatFileSize(att.size)})
          </span>
          <button
            type="button"
            onClick={() => onRemoveAttachment(att.id)}
            style={{
              background: "none",
              border: "none",
              padding: "2px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              cursor: "pointer",
              color: "var(--text-tertiary)",
              transition: "color 0.15s ease, background 0.15s ease",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.color = "#EF4444";
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = "var(--text-tertiary)";
              e.currentTarget.style.background = "none";
            }}
            aria-label="Remove attachment"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

// Convert uploaded file to base64 attachment item
export async function fileToAttachment(file: File): Promise<FileAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Strip data:mime/type;base64, prefix for clean base64 payload
      const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
      const previewUrl = file.type.startsWith("image/") ? dataUrl : undefined;

      resolve({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        base64,
        previewUrl,
      });
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

// Animated soundwave indicator bar for active microphone recording
export function VoiceWaveVisualizer({
  isListening,
  onStop,
  label = "Listening to voice dictation…",
  liveTranscript,
}: {
  isListening: boolean;
  onStop?: () => void;
  label?: string;
  liveTranscript?: string;
}) {
  if (!isListening) return null;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0.5rem 0.875rem",
      borderRadius: "var(--radius-lg)",
      background: "linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(249, 115, 22, 0.1))",
      border: "1px solid rgba(239, 68, 68, 0.3)",
      color: "var(--text-primary)",
      fontSize: "12px",
      fontWeight: 600,
      marginBottom: "0.5rem",
      animation: "fadeIn 0.2s ease-out",
      gap: "0.5rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", minWidth: 0, flex: 1, overflow: "hidden" }}>
        {/* Pulsing Red Dot */}
        <span style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: "#EF4444",
          boxShadow: "0 0 10px #EF4444",
          animation: "pulseRed 1.2s infinite ease-in-out",
          flexShrink: 0,
        }} />

        <span style={{ flexShrink: 0 }}>{label}</span>

        {/* 5-bar soundwave visualizer */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: "3px", height: "16px", marginLeft: "2px", flexShrink: 0 }}>
          {[0.2, 0.5, 0.9, 0.4, 0.7].map((h, idx) => (
            <span
              key={idx}
              style={{
                width: "3px",
                height: `${Math.round(h * 16)}px`,
                background: "#EF4444",
                borderRadius: "2px",
                animation: `soundwave 0.8s ease-in-out infinite alternate ${idx * 0.15}s`,
              }}
            />
          ))}
        </div>

        {/* Live words preview */}
        {liveTranscript && (
          <span style={{
            fontSize: "11px",
            color: "#EF4444",
            fontStyle: "italic",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            padding: "0.1rem 0.4rem",
            borderRadius: "4px",
            background: "rgba(239, 68, 68, 0.1)",
          }}>
            &ldquo;{liveTranscript}&rdquo;
          </span>
        )}
      </div>

      {onStop && (
        <button
          type="button"
          onClick={onStop}
          style={{
            background: "rgba(239, 68, 68, 0.18)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            borderRadius: "var(--radius-full)",
            padding: "0.2rem 0.6rem",
            color: "#EF4444",
            fontSize: "11px",
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
            flexShrink: 0,
          }}
        >
          <Square size={10} fill="#EF4444" stroke="none" />
          Done
        </button>
      )}
    </div>
  );
}
