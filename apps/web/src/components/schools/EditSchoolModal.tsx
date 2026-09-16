"use client";

import React, { useState } from "react";
import { apiClient } from "@/lib/axios";
import { Building2, X, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface EditSchoolModalProps {
  school: any;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updatedSchool: any) => void;
}

const BOARD_OPTIONS = [
  { value: "CBSE", label: "CBSE" },
  { value: "ICSE", label: "CISCE / ICSE" },
  { value: "STATE", label: "State Education Board" },
  { value: "IB", label: "International Baccalaureate (IB)" },
  { value: "CAMBRIDGE", label: "Cambridge International" },
];

export function EditSchoolModal({ school, isOpen, onClose, onSaved }: EditSchoolModalProps) {
  const [form, setForm] = useState({
    name: school?.name || "",
    boardType: school?.boardType || "CBSE",
    affiliationNo: school?.affiliationNo || "",
    udiseCode: school?.udiseCode || "",
    principalName: school?.principalName || "",
    phone: school?.phone || "",
    email: school?.email || "",
    website: school?.website || "",
    address: school?.address || "",
    city: school?.city || "",
    state: school?.state || "",
    pinCode: school?.pinCode || "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !school) return null;

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("School name is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await apiClient.put(`/schools/${school.id}`, {
        name: form.name.trim(),
        boardType: form.boardType,
        affiliationNo: form.affiliationNo.trim() || undefined,
        udiseCode: form.udiseCode.trim() || undefined,
        principalName: form.principalName.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        website: form.website.trim() || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        pinCode: form.pinCode.trim() || undefined,
      });

      onSaved(res.data);
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to update school details";
      setError(Array.isArray(msg) ? msg.join(", ") : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
        animation: "fadeIn 0.2s ease-out",
      }}
      onClick={onClose}
    >
      <div
        className="modal-dialog"
        style={{
          width: "100%",
          maxWidth: "600px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: "var(--radius-xl)",
          backgroundColor: "var(--bg-surface-solid, #1E293B)",
          border: "1px solid var(--border-default)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid var(--border-default)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--bg-surface)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-md)",
                background: "rgba(37, 99, 235, 0.1)",
                color: "var(--primary-600)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Building2 size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 700, color: "var(--text-primary)" }}>
                Edit Campus Details
              </h3>
              <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                Code: <strong>{school.code}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-tertiary)",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <div style={{ padding: "1.25rem 1.5rem", overflowY: "auto", flex: 1 }}>
            {error && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.75rem",
                  borderRadius: "var(--radius-md)",
                  background: "rgba(239, 68, 68, 0.1)",
                  color: "var(--status-danger)",
                  fontSize: "var(--text-xs)",
                  marginBottom: "1rem",
                }}
              >
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
              <div style={{ gridColumn: "span 2" }}>
                <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                  School Name
                </label>
                <input
                  type="text"
                  className="input"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  style={{ width: "100%" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                  Board Type
                </label>
                <select
                  className="input"
                  value={form.boardType}
                  onChange={(e) => handleChange("boardType", e.target.value)}
                  style={{ width: "100%" }}
                >
                  {BOARD_OPTIONS.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                  Principal Name
                </label>
                <input
                  type="text"
                  className="input"
                  value={form.principalName}
                  onChange={(e) => handleChange("principalName", e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                  Affiliation No.
                </label>
                <input
                  type="text"
                  className="input"
                  value={form.affiliationNo}
                  onChange={(e) => handleChange("affiliationNo", e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                  UDISE+ Code
                </label>
                <input
                  type="text"
                  className="input"
                  value={form.udiseCode}
                  onChange={(e) => handleChange("udiseCode", e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ gridColumn: "span 2" }}>
                <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                  Street Address
                </label>
                <input
                  type="text"
                  className="input"
                  value={form.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                  City
                </label>
                <input
                  type="text"
                  className="input"
                  value={form.city}
                  onChange={(e) => handleChange("city", e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                  State
                </label>
                <input
                  type="text"
                  className="input"
                  value={form.state}
                  onChange={(e) => handleChange("state", e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                  PIN Code
                </label>
                <input
                  type="text"
                  className="input"
                  value={form.pinCode}
                  onChange={(e) => handleChange("pinCode", e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                  Phone
                </label>
                <input
                  type="text"
                  className="input"
                  value={form.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                  Email
                </label>
                <input
                  type="email"
                  className="input"
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                  Website
                </label>
                <input
                  type="text"
                  className="input"
                  value={form.website}
                  onChange={(e) => handleChange("website", e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "1rem 1.5rem",
              borderTop: "1px solid var(--border-default)",
              background: "var(--bg-surface-solid)",
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.5rem",
            }}
          >
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
