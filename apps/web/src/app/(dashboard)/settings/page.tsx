"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Save, School, Calendar, DollarSign, Users, Plus, CheckCircle2 } from "lucide-react";

type SettingsTab = "school" | "academic" | "feeheads" | "users";

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>("school");
  const [school, setSchool] = useState<any>(null);
  const [schoolForm, setSchoolForm] = useState<any>({});
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [feeHeads, setFeeHeads] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Academic year form
  const [ayForm, setAyForm] = useState({ name: "", startDate: "", endDate: "" });
  const [creatingAY, setCreatingAY] = useState(false);

  // Fee head form
  const [fhForm, setFhForm] = useState({ name: "", description: "" });
  const [creatingFH, setCreatingFH] = useState(false);

  const showMsg = (text: string, type: "success" | "error") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  };

  const fetchData = useCallback(async () => {
    try {
      if (tab === "school") {
        const res = await apiClient.get("/schools/current");
        const data = res.data.data || res.data;
        setSchool(data);
        setSchoolForm(data || {});
      } else if (tab === "academic") {
        const res = await apiClient.get("/schools/academic-years");
        setAcademicYears(res.data.data || res.data || []);
      } else if (tab === "feeheads") {
        const res = await apiClient.get("/fees/heads");
        setFeeHeads(res.data.data || res.data || []);
      }
    } catch (err: any) {
      showMsg(err?.response?.data?.message || "Failed to load data", "error");
    }
  }, [tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const tabs: { key: SettingsTab; label: string; icon: any }[] = [
    { key: "school", label: "School Profile", icon: School },
    { key: "academic", label: "Academic Years", icon: Calendar },
    { key: "feeheads", label: "Fee Heads", icon: DollarSign },
    { key: "users", label: "Users", icon: Users },
  ];

  const handleSaveSchool = async () => {
    setSaving(true);
    try {
      await apiClient.put("/schools/current", schoolForm);
      showMsg("School profile updated successfully!", "success");
    } catch (err: any) {
      showMsg(err?.response?.data?.message || "Failed to save school profile", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAY = async () => {
    if (!ayForm.name || !ayForm.startDate || !ayForm.endDate) {
      showMsg("Please fill in all academic year fields", "error");
      return;
    }
    setCreatingAY(true);
    try {
      await apiClient.post("/schools/academic-years", ayForm);
      setAyForm({ name: "", startDate: "", endDate: "" });
      fetchData();
      showMsg("Academic year created successfully!", "success");
    } catch (err: any) {
      showMsg(err?.response?.data?.message || "Failed to create academic year", "error");
    } finally {
      setCreatingAY(false);
    }
  };

  const handleActivateAY = async (yearId: string) => {
    setActivating(yearId);
    try {
      await apiClient.patch(`/schools/academic-years/${yearId}/activate`);
      fetchData();
      showMsg("Academic year activated!", "success");
    } catch (err: any) {
      showMsg(err?.response?.data?.message || "Failed to activate academic year", "error");
    } finally {
      setActivating(null);
    }
  };

  const handleCreateFH = async () => {
    if (!fhForm.name) {
      showMsg("Fee head name is required", "error");
      return;
    }
    setCreatingFH(true);
    try {
      await apiClient.post("/fees/heads", fhForm);
      setFhForm({ name: "", description: "" });
      fetchData();
      showMsg("Fee head created successfully!", "success");
    } catch (err: any) {
      showMsg(err?.response?.data?.message || "Failed to create fee head", "error");
    } finally {
      setCreatingFH(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)", marginBottom: "0.25rem" }}>Settings</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>Manage school configuration and system settings</p>
      </div>

      <div style={{ display: "flex", gap: "1.5rem" }}>
        {/* Sidebar tabs */}
        <div style={{ width: "200px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem",
                borderRadius: "var(--radius-md)", border: "none", cursor: "pointer", fontSize: "var(--text-sm)",
                fontWeight: tab === t.key ? 600 : 400,
                background: tab === t.key ? "var(--primary-50)" : "transparent",
                color: tab === t.key ? "var(--primary-600)" : "var(--text-secondary)",
                transition: "all 0.15s", textAlign: "left", width: "100%",
              }}>
              <t.icon size={16} />{t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", padding: "1.5rem", border: "1px solid var(--border-default)", minHeight: "400px" }}>
          {msg && (
            <div style={{
              marginBottom: "1rem", padding: "0.75rem 1rem", borderRadius: "var(--radius-md)",
              background: msg.type === "success" ? "#f0fdf4" : "#fef2f2",
              color: msg.type === "success" ? "#166534" : "#991b1b",
              border: `1px solid ${msg.type === "success" ? "#bbf7d0" : "#fecaca"}`,
              fontSize: "var(--text-sm)", fontWeight: 500
            }}>
              {msg.text}
            </div>
          )}

          {/* ── School Profile ── */}
          {tab === "school" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "600px" }}>
              <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600 }}>School Profile</h2>
              {school === null ? (
                <div style={{ color: "var(--text-secondary)" }}>Loading school data...</div>
              ) : school === undefined || Object.keys(school).length === 0 ? (
                <div style={{ color: "var(--text-secondary)" }}>No school data found.</div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <Input label="School Name" value={schoolForm.name || ""} onChange={e => setSchoolForm((f: any) => ({ ...f, name: e.target.value }))} id="school-name" />
                    <Input label="School Code" value={schoolForm.code || ""} disabled id="school-code" />
                    <Input label="Phone" value={schoolForm.phone || ""} onChange={e => setSchoolForm((f: any) => ({ ...f, phone: e.target.value }))} id="school-phone" />
                    <Input label="Email" value={schoolForm.email || ""} onChange={e => setSchoolForm((f: any) => ({ ...f, email: e.target.value }))} id="school-email" />
                    <Input label="City" value={schoolForm.city || ""} onChange={e => setSchoolForm((f: any) => ({ ...f, city: e.target.value }))} id="school-city" />
                    <Input label="State" value={schoolForm.state || ""} onChange={e => setSchoolForm((f: any) => ({ ...f, state: e.target.value }))} id="school-state" />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                    <label style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-secondary)" }}>Board Type</label>
                    <select
                      value={schoolForm.boardType || ""}
                      onChange={e => setSchoolForm((f: any) => ({ ...f, boardType: e.target.value }))}
                      style={{ padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-surface-solid)", color: "var(--text-primary)", fontSize: "var(--text-sm)" }}>
                      <option value="">Select Board</option>
                      {["CBSE", "ICSE", "State Board", "IB", "Cambridge"].map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <Button style={{ alignSelf: "flex-start" }} isLoading={saving} onClick={handleSaveSchool}>
                    <Save size={16} style={{ marginRight: "0.5rem" }} /> Save Changes
                  </Button>
                </>
              )}
            </div>
          )}

          {/* ── Academic Years ── */}
          {tab === "academic" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600 }}>Academic Years</h2>

              {/* Create form */}
              <div style={{ background: "var(--bg-app)", borderRadius: "var(--radius-md)", padding: "1.25rem", border: "1px solid var(--border-default)" }}>
                <h3 style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Plus size={16} /> Create New Academic Year
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                  <Input
                    label="Year Name *"
                    placeholder="e.g. 2026-27"
                    value={ayForm.name}
                    onChange={e => setAyForm(f => ({ ...f, name: e.target.value }))}
                  />
                  <Input
                    label="Start Date *"
                    type="date"
                    value={ayForm.startDate}
                    onChange={e => setAyForm(f => ({ ...f, startDate: e.target.value }))}
                  />
                  <Input
                    label="End Date *"
                    type="date"
                    value={ayForm.endDate}
                    onChange={e => setAyForm(f => ({ ...f, endDate: e.target.value }))}
                  />
                </div>
                <Button onClick={handleCreateAY} isLoading={creatingAY}>
                  <Plus size={16} style={{ marginRight: "0.5rem" }} /> Create Academic Year
                </Button>
              </div>

              {/* List */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {academicYears.length === 0 ? (
                  <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
                    No academic years created yet. Create your first one above.
                  </p>
                ) : (
                  academicYears.map((ay: any) => (
                    <div key={ay.id} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "1rem", background: "var(--bg-surface-solid)", borderRadius: "var(--radius-md)",
                      border: `1.5px solid ${ay.isActive ? "var(--primary-500)" : "var(--border-default)"}`
                    }}>
                      <div>
                        <p style={{ fontWeight: 600, marginBottom: "0.2rem" }}>{ay.name}</p>
                        <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
                          {new Date(ay.startDate).toLocaleDateString("en-IN")} – {new Date(ay.endDate).toLocaleDateString("en-IN")}
                        </p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        {ay.isActive ? (
                          <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", background: "#f0fdf4", color: "#166534", padding: "0.25rem 0.75rem", borderRadius: "var(--radius-full)", fontSize: "var(--text-xs)", fontWeight: 600 }}>
                            <CheckCircle2 size={12} /> Active
                          </span>
                        ) : (
                          <Button
                            onClick={() => handleActivateAY(ay.id)}
                            isLoading={activating === ay.id}
                            style={{ padding: "0.375rem 0.875rem", fontSize: "var(--text-xs)" }}
                          >
                            Set Active
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── Fee Heads ── */}
          {tab === "feeheads" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600 }}>Fee Heads</h2>

              <div style={{ background: "var(--bg-app)", borderRadius: "var(--radius-md)", padding: "1.25rem", border: "1px solid var(--border-default)" }}>
                <h3 style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Plus size={16} /> Add Fee Head
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                  <Input
                    label="Fee Head Name *"
                    placeholder="e.g. Tuition Fee"
                    value={fhForm.name}
                    onChange={e => setFhForm(f => ({ ...f, name: e.target.value }))}
                  />
                  <Input
                    label="Description"
                    placeholder="Optional description"
                    value={fhForm.description}
                    onChange={e => setFhForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <Button onClick={handleCreateFH} isLoading={creatingFH}>
                  <Plus size={16} style={{ marginRight: "0.5rem" }} /> Add Fee Head
                </Button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {feeHeads.length === 0 ? (
                  <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
                    No fee heads created yet.
                  </p>
                ) : (
                  feeHeads.map((fh: any) => (
                    <div key={fh.id} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "0.875rem 1rem", background: "var(--bg-surface-solid)", borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-default)"
                    }}>
                      <div>
                        <p style={{ fontWeight: 500 }}>{fh.name}</p>
                        {fh.description && <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>{fh.description}</p>}
                      </div>
                      <span style={{
                        background: fh.isActive ? "#f0fdf4" : "var(--bg-app)",
                        color: fh.isActive ? "#166534" : "var(--text-tertiary)",
                        padding: "0.25rem 0.625rem", borderRadius: "var(--radius-full)",
                        fontSize: "var(--text-xs)", fontWeight: 600
                      }}>
                        {fh.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── Users ── */}
          {tab === "users" && (
            <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
              <Users size={48} style={{ marginBottom: "1rem", color: "var(--text-tertiary)" }} />
              <p style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginBottom: "0.5rem" }}>User Management</p>
              <p style={{ marginBottom: "1.5rem" }}>Create, edit, and manage user accounts and roles.</p>
              <Button onClick={() => window.location.href = "/students"}>Go to Students</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
