import React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Sparkles } from "lucide-react";

export function InitCurriculumModal({
  isOpen,
  onClose,
  initializing,
  handleLoadRecommended,
  selectedBoardId,
  boards,
}: {
  isOpen: boolean;
  onClose: () => void;
  initializing: boolean;
  handleLoadRecommended: () => void;
  selectedBoardId: string;
  boards: any[];
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Load Recommended Curriculum Template"
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", width: "100%" }}>
          <Button variant="outline" onClick={onClose} disabled={initializing}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleLoadRecommended} disabled={initializing}>
            {initializing ? "Loading Framework..." : "Confirm & Load Framework"}
          </Button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", fontSize: "var(--text-sm)" }}>
        <div
          style={{
            padding: "1rem",
            borderRadius: "var(--radius-md)",
            background: "rgba(99, 102, 241, 0.08)",
            border: "1px solid rgba(99, 102, 241, 0.2)",
            display: "flex",
            alignItems: "flex-start",
            gap: "0.75rem",
          }}
        >
          <Sparkles size={20} style={{ color: "var(--brand-primary)", flexShrink: 0, marginTop: "2px" }} />
          <div>
            <p style={{ fontWeight: 700, color: "var(--text-primary)" }}>
              Initialize Standard Academic Framework
            </p>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginTop: "0.2rem" }}>
              This will populate the official Classes 1–10 subject groupings, codes, and baseline assessment models for{" "}
              <strong>
                {boards.find((b) => b.id === selectedBoardId)?.name || "the selected board"}
              </strong>.
            </p>
          </div>
        </div>

        <ul style={{ paddingLeft: "1.25rem", color: "var(--text-secondary)", lineHeight: 1.6, fontSize: "0.85rem" }}>
          <li>Existing custom subjects and marks records will NOT be deleted.</li>
          <li>All loaded subjects can be modified, enabled, or disabled at any time.</li>
          <li>Class and Section subject mappings will reference these standard offerings.</li>
        </ul>
      </div>
    </Modal>
  );
}
