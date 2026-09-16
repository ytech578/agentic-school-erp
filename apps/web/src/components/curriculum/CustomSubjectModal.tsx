import React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function CustomSubjectModal({
  isOpen,
  onClose,
  savingCustom,
  handleCreateCustomSubject,
  customForm,
  setCustomForm,
}: {
  isOpen: boolean;
  onClose: () => void;
  savingCustom: boolean;
  handleCreateCustomSubject: () => void;
  customForm: any;
  setCustomForm: (val: any) => void;
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Custom School Subject"
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", width: "100%" }}>
          <Button variant="outline" onClick={onClose} disabled={savingCustom}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreateCustomSubject} disabled={savingCustom}>
            {savingCustom ? "Saving..." : "Save Subject"}
          </Button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <label style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
            Subject Name *
          </label>
          <Input
            placeholder="e.g. Robotics & STEM, Spoken English, Vedic Math"
            value={customForm.customName}
            onChange={(e) => setCustomForm({ ...customForm, customName: e.target.value })}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <label style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
              Subject Code (Optional)
            </label>
            <Input
              placeholder="e.g. ROB-01"
              value={customForm.customCode}
              onChange={(e) => setCustomForm({ ...customForm, customCode: e.target.value })}
            />
          </div>
          <div>
            <label style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
              Periods Per Week
            </label>
            <Input
              type="number"
              min={1}
              max={20}
              value={customForm.periodsPerWeek}
              onChange={(e) => setCustomForm({ ...customForm, periodsPerWeek: Number(e.target.value) })}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <label style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
              Applicable From Grade
            </label>
            <select
              value={customForm.gradeFrom}
              onChange={(e) => setCustomForm({ ...customForm, gradeFrom: Number(e.target.value) })}
              style={{
                width: "100%",
                padding: "0.55rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-default)",
                background: "var(--bg-surface)",
                fontSize: "var(--text-sm)",
                color: "var(--text-primary)",
              }}
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((g) => (
                <option key={g} value={g}>Class {g}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
              Applicable To Grade
            </label>
            <select
              value={customForm.gradeTo}
              onChange={(e) => setCustomForm({ ...customForm, gradeTo: Number(e.target.value) })}
              style={{
                width: "100%",
                padding: "0.55rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-default)",
                background: "var(--bg-surface)",
                fontSize: "var(--text-sm)",
                color: "var(--text-primary)",
              }}
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((g) => (
                <option key={g} value={g} disabled={g < customForm.gradeFrom}>Class {g}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <label style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
              Classification
            </label>
            <select
              value={customForm.subjectType}
              onChange={(e) => setCustomForm({ ...customForm, subjectType: e.target.value })}
              style={{
                width: "100%",
                padding: "0.55rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-default)",
                background: "var(--bg-surface)",
                fontSize: "var(--text-sm)",
                color: "var(--text-primary)",
              }}
            >
              <option value="ADDITIONAL">Additional Subject</option>
              <option value="CO_CURRICULAR">Co-Curricular</option>
              <option value="VOCATIONAL">Vocational / Skill</option>
              <option value="LANGUAGE">Language</option>
              <option value="CORE">Core Academic</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
              Selection Type
            </label>
            <select
              value={customForm.selectionType}
              onChange={(e) => setCustomForm({ ...customForm, selectionType: e.target.value })}
              style={{
                width: "100%",
                padding: "0.55rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-default)",
                background: "var(--bg-surface)",
                fontSize: "var(--text-sm)",
                color: "var(--text-primary)",
              }}
            >
              <option value="MANDATORY">Mandatory</option>
              <option value="OPTIONAL">Optional</option>
              <option value="ELECTIVE">Elective</option>
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", paddingTop: "0.5rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={customForm.theoryEnabled}
              onChange={(e) => setCustomForm({ ...customForm, theoryEnabled: e.target.checked })}
            />
            Theory Enabled
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={customForm.practicalEnabled}
              onChange={(e) => setCustomForm({ ...customForm, practicalEnabled: e.target.checked })}
            />
            Practical / Lab
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={customForm.internalAssessmentEnabled}
              onChange={(e) => setCustomForm({ ...customForm, internalAssessmentEnabled: e.target.checked })}
            />
            Internal Assessment
          </label>
        </div>
      </div>
    </Modal>
  );
}
