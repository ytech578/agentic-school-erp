"use client";

import React, { useState } from "react";
import { apiClient } from "@/lib/axios";
import {
  Building2,
  MapPin,
  ShieldCheck,
  UserCheck,
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

interface CreateSchoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newSchool: any) => void;
}

const BOARD_OPTIONS = [
  { value: "CBSE", label: "CBSE (Central Board of Secondary Education)" },
  { value: "ICSE", label: "CISCE / ICSE" },
  { value: "STATE", label: "State Education Board" },
  { value: "IB", label: "International Baccalaureate (IB)" },
  { value: "CAMBRIDGE", label: "Cambridge International (IGCSE)" },
];

export function CreateSchoolModal({ isOpen, onClose, onSuccess }: CreateSchoolModalProps) {
  const currentYear = new Date().getFullYear();
  const [activeTab, setActiveTab] = useState<"profile" | "location" | "admin">("profile");

  const [form, setForm] = useState({
    name: "",
    code: "",
    boardType: "CBSE",
    affiliationNo: "",
    udiseCode: "",
    principalName: "",
    phone: "",
    email: "",
    website: "",
    address: "",
    city: "",
    state: "",
    pinCode: "",
    academicYearName: `${currentYear}-${currentYear + 1}`,
    adminFirstName: "",
    adminLastName: "",
    adminEmail: "",
    adminPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: field === "code" ? value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") : value,
    }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("School name is required");
      setActiveTab("profile");
      return;
    }
    if (!form.code.trim()) {
      setError("Unique School Code identifier is required");
      setActiveTab("profile");
      return;
    }

    if (form.adminEmail && !form.adminPassword) {
      setError("Please provide an initial password for the school administrator account");
      setActiveTab("admin");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await apiClient.post("/schools", {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
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
        academicYearName: form.academicYearName.trim() || undefined,
        adminFirstName: form.adminFirstName.trim() || undefined,
        adminLastName: form.adminLastName.trim() || undefined,
        adminEmail: form.adminEmail.trim() || undefined,
        adminPassword: form.adminPassword.trim() || undefined,
      });

      const result = res.data;
      setSuccessResult(result);
      if (onSuccess) {
        onSuccess(result?.school || result);
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to onboard school. Please check the provided information.";
      setError(Array.isArray(msg) ? msg.join(", ") : msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSuccessResult(null);
    setError(null);
    onClose();
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
      onClick={handleClose}
    >
      <div
        className="modal-dialog"
        style={{
          width: "100%",
          maxWidth: "680px",
          maxHeight: "92vh",
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
        {/* Modal Header */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid var(--border-default)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(6, 182, 212, 0.05) 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "var(--radius-lg)",
                background: "linear-gradient(135deg, #2563EB 0%, #06B6D4 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)",
              }}
            >
              <Building2 size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: 800, color: "var(--text-primary)" }}>
                Onboard New School Campus
              </h3>
              <p style={{ margin: "0.15rem 0 0", fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                Provision a new institution with automated academic years, departments, and admin credentials.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-tertiary)",
              padding: "0.4rem",
              borderRadius: "var(--radius-md)",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Success View */}
        {successResult ? (
          <div style={{ padding: "2rem 1.5rem", textAlign: "center" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "rgba(16, 185, 129, 0.15)",
                color: "var(--status-success)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.25rem",
              }}
            >
              <CheckCircle2 size={32} />
            </div>
            <h4 style={{ fontSize: "var(--text-xl)", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
              Campus Successfully Onboarded!
            </h4>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: "0.5rem" }}>
              <strong>{successResult.school?.name}</strong> has been registered into the multi-tenant fleet with school code{" "}
              <strong style={{ color: "var(--primary-600)" }}>{successResult.school?.code}</strong>.
            </p>

            <div
              style={{
                background: "var(--bg-app)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-lg)",
                padding: "1rem",
                margin: "1.5rem auto",
                textAlign: "left",
                maxWidth: "480px",
                fontSize: "var(--text-xs)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: "1px solid var(--border-default)" }}>
                <span style={{ color: "var(--text-secondary)" }}>Active Academic Year:</span>
                <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{successResult.academicYear?.name || "2026-2027"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: "1px solid var(--border-default)" }}>
                <span style={{ color: "var(--text-secondary)" }}>Provisioned Departments:</span>
                <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>5 Core Standard Departments</span>
              </div>
              {successResult.initialAdmin && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0" }}>
                  <span style={{ color: "var(--text-secondary)" }}>School Admin Login:</span>
                  <span style={{ fontWeight: 700, color: "var(--status-success)" }}>{successResult.initialAdmin?.email}</span>
                </div>
              )}
            </div>

            <Button variant="primary" onClick={handleClose} style={{ minWidth: "160px" }}>
              Done & Return to Fleet
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
            {/* Tabs Navigation */}
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid var(--border-default)",
                background: "var(--bg-surface-solid)",
                padding: "0 1.5rem",
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                style={{
                  padding: "0.75rem 1rem",
                  border: "none",
                  background: "none",
                  borderBottom: activeTab === "profile" ? "2px solid var(--primary-600)" : "2px solid transparent",
                  color: activeTab === "profile" ? "var(--primary-600)" : "var(--text-secondary)",
                  fontWeight: activeTab === "profile" ? 700 : 500,
                  fontSize: "var(--text-sm)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <Building2 size={16} /> Campus Identity
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("location")}
                style={{
                  padding: "0.75rem 1rem",
                  border: "none",
                  background: "none",
                  borderBottom: activeTab === "location" ? "2px solid var(--primary-600)" : "2px solid transparent",
                  color: activeTab === "location" ? "var(--primary-600)" : "var(--text-secondary)",
                  fontWeight: activeTab === "location" ? 700 : 500,
                  fontSize: "var(--text-sm)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <MapPin size={16} /> Location & Contact
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("admin")}
                style={{
                  padding: "0.75rem 1rem",
                  border: "none",
                  background: "none",
                  borderBottom: activeTab === "admin" ? "2px solid var(--primary-600)" : "2px solid transparent",
                  color: activeTab === "admin" ? "var(--primary-600)" : "var(--text-secondary)",
                  fontWeight: activeTab === "admin" ? 700 : 500,
                  fontSize: "var(--text-sm)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <UserCheck size={16} /> Initial Administrator
              </button>
            </div>

            {/* Modal Body with Scroll */}
            <div style={{ padding: "1.25rem 1.5rem", overflowY: "auto", flex: 1 }}>
              {error && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.75rem 1rem",
                    borderRadius: "var(--radius-md)",
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    color: "var(--status-danger)",
                    fontSize: "var(--text-xs)",
                    marginBottom: "1rem",
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              {/* Tab 1: Campus Profile */}
              {activeTab === "profile" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
                  <div style={{ gridColumn: "span 2" }}>
                    <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                      School / Institution Name <span style={{ color: "var(--status-danger)" }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Greenwood International Academy"
                      value={form.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      required
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                      Unique School Code <span style={{ color: "var(--status-danger)" }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. GIA-BLR or SCH-002"
                      value={form.code}
                      onChange={(e) => handleChange("code", e.target.value)}
                      required
                      style={{ width: "100%", textTransform: "uppercase", fontWeight: 700 }}
                    />
                    <span style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "0.2rem", display: "block" }}>
                      Used for unique identification and sub-tenant routing.
                    </span>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                      Board / Curriculum Type
                    </label>
                    <select
                      className="input"
                      value={form.boardType}
                      onChange={(e) => handleChange("boardType", e.target.value)}
                      style={{ width: "100%" }}
                    >
                      {BOARD_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                      Board Affiliation Number
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. CBSE/AFF/2026/041"
                      value={form.affiliationNo}
                      onChange={(e) => handleChange("affiliationNo", e.target.value)}
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                      UDISE+ Code
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. 29280600102"
                      value={form.udiseCode}
                      onChange={(e) => handleChange("udiseCode", e.target.value)}
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div style={{ gridColumn: "span 2" }}>
                    <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                      Head of School / Principal Name
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Dr. Sudha Nair"
                      value={form.principalName}
                      onChange={(e) => handleChange("principalName", e.target.value)}
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div style={{ gridColumn: "span 2" }}>
                    <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                      Initial Active Academic Year
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. 2026-2027"
                      value={form.academicYearName}
                      onChange={(e) => handleChange("academicYearName", e.target.value)}
                      style={{ width: "100%" }}
                    />
                    <span style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "0.2rem", display: "block" }}>
                      An initial active academic year will automatically be provisioned with standard dates.
                    </span>
                  </div>
                </div>
              )}

              {/* Tab 2: Location & Contact */}
              {activeTab === "location" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
                  <div style={{ gridColumn: "span 2" }}>
                    <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                      Street Address
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Survey 14/2, Whitefield Road"
                      value={form.address}
                      onChange={(e) => handleChange("address", e.target.value)}
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                      City
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Bengaluru"
                      value={form.city}
                      onChange={(e) => handleChange("city", e.target.value)}
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                      State / Province
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Karnataka"
                      value={form.state}
                      onChange={(e) => handleChange("state", e.target.value)}
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                      PIN / Postal Code
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. 560066"
                      value={form.pinCode}
                      onChange={(e) => handleChange("pinCode", e.target.value)}
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                      Official Phone
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. +91 80 2845 0000"
                      value={form.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                      Official School Email
                    </label>
                    <input
                      type="email"
                      className="input"
                      placeholder="e.g. contact@greenwood.edu"
                      value={form.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                      Website URL
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. https://greenwood.edu"
                      value={form.website}
                      onChange={(e) => handleChange("website", e.target.value)}
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>
              )}

              {/* Tab 3: Initial School Admin Setup */}
              {activeTab === "admin" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div
                    style={{
                      padding: "0.875rem 1rem",
                      borderRadius: "var(--radius-lg)",
                      background: "rgba(37, 99, 235, 0.08)",
                      border: "1px solid rgba(37, 99, 235, 0.2)",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "0.75rem",
                    }}
                  >
                    <ShieldCheck size={20} style={{ color: "var(--primary-600)", flexShrink: 0, marginTop: "0.1rem" }} />
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                      <strong style={{ color: "var(--text-primary)", display: "block", marginBottom: "0.2rem" }}>
                        Initial School Admin Account (Optional)
                      </strong>
                      Provision a primary administrator account for this campus. They will be granted full `SCHOOL_ADMIN` permissions scoped specifically to this new school tenant.
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                        Admin First Name
                      </label>
                      <input
                        type="text"
                        className="input"
                        placeholder="e.g. Rajesh"
                        value={form.adminFirstName}
                        onChange={(e) => handleChange("adminFirstName", e.target.value)}
                        style={{ width: "100%" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                        Admin Last Name
                      </label>
                      <input
                        type="text"
                        className="input"
                        placeholder="e.g. Verma"
                        value={form.adminLastName}
                        onChange={(e) => handleChange("adminLastName", e.target.value)}
                        style={{ width: "100%" }}
                      />
                    </div>

                    <div style={{ gridColumn: "span 2" }}>
                      <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                        Admin Login Email
                      </label>
                      <input
                        type="email"
                        className="input"
                        placeholder="e.g. admin.greenwood@schoolerp.in"
                        value={form.adminEmail}
                        onChange={(e) => handleChange("adminEmail", e.target.value)}
                        style={{ width: "100%" }}
                      />
                    </div>

                    <div style={{ gridColumn: "span 2" }}>
                      <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                        Temporary Password
                      </label>
                      <input
                        type="password"
                        className="input"
                        placeholder="Minimum 6 characters"
                        value={form.adminPassword}
                        onChange={(e) => handleChange("adminPassword", e.target.value)}
                        style={{ width: "100%" }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "1rem 1.5rem",
                borderTop: "1px solid var(--border-default)",
                background: "var(--bg-surface-solid)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Button type="button" variant="ghost" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                {activeTab !== "admin" ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveTab(activeTab === "profile" ? "location" : "admin")}
                  >
                    Next Step →
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveTab("location")}
                  >
                    ← Previous
                  </Button>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  disabled={loading}
                  style={{
                    background: "linear-gradient(135deg, #2563EB 0%, #06B6D4 100%)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                  }}
                >
                  <Sparkles size={16} />
                  {loading ? "Provisioning..." : "Onboard School"}
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
