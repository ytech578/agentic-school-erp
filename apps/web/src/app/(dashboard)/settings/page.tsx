"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Save, School, Calendar, DollarSign, Users, Plus, CheckCircle2,
  User, Settings2, Shield, Bell, Lock, ShieldAlert, Loader2,
  Building2, GraduationCap, CreditCard, UserCog, Pencil, X, Check,
  Phone, Mail, Camera, LogOut, Key, ToggleRight, Info, ChevronRight, BookOpen,
} from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { CurriculumManager } from "@/components/curriculum/CurriculumManager";

type SettingsTab = "profile" | "school" | "curriculum" | "academic" | "feeheads" | "users" | "preferences" | "security";

// ─── Reusable Section Header ───────────────────────────────────────
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: "1.75rem", paddingBottom: "1.25rem", borderBottom: "1px solid var(--border-light)" }}>
      <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.25rem" }}>{title}</h2>
      {subtitle && <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{subtitle}</p>}
    </div>
  );
}

// ─── Settings Card ─────────────────────────────────────────────────
function SettingsCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "var(--bg-surface)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-xl)",
      padding: "1.5rem",
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─── Form Row ──────────────────────────────────────────────────────
function FormRow({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "1.25rem" }}>
      {children}
    </div>
  );
}

// ─── Toast ─────────────────────────────────────────────────────────
function Toast({ msg, onClose }: { msg: { text: string; type: "success" | "error" } | null; onClose: () => void }) {
  if (!msg) return null;
  const isSuccess = msg.type === "success";
  return (
    <div style={{
      position: "fixed", top: "1.5rem", right: "1.5rem", zIndex: 9999,
      display: "flex", alignItems: "center", gap: "0.75rem",
      padding: "0.875rem 1.25rem",
      background: isSuccess ? "var(--success)" : "var(--danger)",
      color: "#fff",
      borderRadius: "var(--radius-lg)",
      boxShadow: "var(--shadow-e3)",
      fontSize: "var(--text-sm)", fontWeight: 600,
      animation: "slideInRight 0.25s ease",
      maxWidth: "380px",
    }}>
      {isSuccess ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
      <span style={{ flex: 1 }}>{msg.text}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.8)", display: "flex" }}>
        <X size={16} />
      </button>
    </div>
  );
}

// ─── Toggle Switch ─────────────────────────────────────────────────
function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: "48px", height: "26px", borderRadius: "13px", border: "none",
        cursor: "pointer", position: "relative", transition: "background 0.25s",
        background: checked ? "var(--primary-600)" : "var(--slate-300)",
        flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: "3px",
        left: checked ? "25px" : "3px",
        width: "20px", height: "20px",
        borderRadius: "50%", background: "#fff",
        boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
        transition: "left 0.2s",
      }} />
    </button>
  );
}

export default function SettingsPage() {
  const { user: currentUser, updateUser } = useAuthStore();
  const [tab, setTab] = useState<SettingsTab>("profile");
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Profile
  const [profileForm, setProfileForm] = useState({ firstName: "", lastName: "", email: "", phone: "", avatarUrl: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarHover, setAvatarHover] = useState(false);

  // School
  const [school, setSchool] = useState<any>(null);
  const [schoolForm, setSchoolForm] = useState<any>({});
  const [savingSchool, setSavingSchool] = useState(false);

  // Academic
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [ayForm, setAyForm] = useState({ name: "", startDate: "", endDate: "" });
  const [creatingAY, setCreatingAY] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);

  // Fee Heads
  const [feeHeads, setFeeHeads] = useState<any[]>([]);
  const [fhForm, setFhForm] = useState({ name: "", description: "" });
  const [creatingFH, setCreatingFH] = useState(false);

  // Prefs
  const [prefs, setPrefs] = useState({ emailNotif: true, smsNotif: false, weeklyReport: true });

  // Password
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [savingPw, setSavingPw] = useState(false);

  const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(currentUser?.role || "");
  const isPrincipal = currentUser?.role === "PRINCIPAL";
  const hasGlobalAccess = isAdmin || isPrincipal;

  const showMsg = (text: string, type: "success" | "error") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 5000);
  };

  // ── Fetch Data ──────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      if (tab === "profile") {
        const res = await apiClient.get("/users/me");
        const d = res.data.data || res.data;
        setProfileForm({ firstName: d.firstName || "", lastName: d.lastName || "", email: d.email || "", phone: d.phone || "", avatarUrl: d.avatarUrl || "" });
      } else if (tab === "school" && hasGlobalAccess) {
        const res = await apiClient.get("/schools/current");
        const d = res.data.data || res.data;
        setSchool(d); setSchoolForm(d || {});
      } else if (tab === "academic" && hasGlobalAccess) {
        const res = await apiClient.get("/schools/academic-years");
        setAcademicYears(res.data.data || res.data || []);
      } else if (tab === "feeheads" && isAdmin) {
        const res = await apiClient.get("/fees/heads");
        setFeeHeads(res.data.data || res.data || []);
      }
    } catch { /* silent */ }
  }, [tab, hasGlobalAccess, isAdmin]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Handlers ────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await apiClient.patch("/users/me/profile", { firstName: profileForm.firstName, lastName: profileForm.lastName, phone: profileForm.phone, avatarUrl: profileForm.avatarUrl });
      updateUser({ firstName: profileForm.firstName, lastName: profileForm.lastName, avatarUrl: profileForm.avatarUrl });
      showMsg("Profile saved successfully!", "success");
    } catch (e: any) { showMsg(e?.response?.data?.message || "Failed to save profile", "error"); }
    finally { setSavingProfile(false); }
  };

  const handleSaveSchool = async () => {
    setSavingSchool(true);
    try {
      await apiClient.put("/schools/current", schoolForm);
      showMsg("School configuration saved!", "success");
    } catch (e: any) { showMsg(e?.response?.data?.message || "Failed to save", "error"); }
    finally { setSavingSchool(false); }
  };

  const handleCreateAY = async () => {
    if (!ayForm.name || !ayForm.startDate || !ayForm.endDate) { showMsg("Fill all academic year fields", "error"); return; }
    setCreatingAY(true);
    try {
      await apiClient.post("/schools/academic-years", ayForm);
      setAyForm({ name: "", startDate: "", endDate: "" }); fetchData();
      showMsg("Academic year created!", "success");
    } catch (e: any) { showMsg(e?.response?.data?.message || "Failed to create", "error"); }
    finally { setCreatingAY(false); }
  };

  const handleActivateAY = async (id: string) => {
    setActivating(id);
    try {
      await apiClient.patch(`/schools/academic-years/${id}/activate`); fetchData();
      showMsg("Academic year activated!", "success");
    } catch { showMsg("Failed to activate", "error"); }
    finally { setActivating(null); }
  };

  const handleCreateFH = async () => {
    if (!fhForm.name) { showMsg("Fee head name is required", "error"); return; }
    setCreatingFH(true);
    try {
      await apiClient.post("/fees/heads", fhForm);
      setFhForm({ name: "", description: "" }); fetchData();
      showMsg("Fee component added!", "success");
    } catch (e: any) { showMsg(e?.response?.data?.message || "Failed", "error"); }
    finally { setCreatingFH(false); }
  };

  // ── Tab Config ──────────────────────────────────────────────────
  const adminTabs = hasGlobalAccess ? [
    { key: "school", label: "School Config", icon: Building2, group: "Administration" },
    { key: "curriculum", label: "Curriculum & Boards", icon: BookOpen, group: "Administration" },
    { key: "academic", label: "Academic Years", icon: GraduationCap, group: "Administration" },
    ...(isAdmin ? [{ key: "feeheads", label: "Fee Components", icon: CreditCard, group: "Administration" }] : []),
    { key: "users", label: "User Directory", icon: Users, group: "Administration" },
  ] : [];

  const personalTabs = [
    { key: "profile", label: "My Profile", icon: User, group: "Personal" },
    { key: "preferences", label: "Preferences", icon: Bell, group: "Personal" },
    { key: "security", label: "Security", icon: Shield, group: "Personal" },
  ];

  const allTabs = [...adminTabs, ...personalTabs];

  // role badge
  const roleBadgeColors: Record<string, { bg: string; color: string; label: string }> = {
    SUPER_ADMIN: { bg: "#7C3AED", color: "#fff", label: "Super Admin" },
    SCHOOL_ADMIN: { bg: "var(--primary-600)", color: "#fff", label: "School Admin" },
    PRINCIPAL: { bg: "var(--teal-600)", color: "#fff", label: "Principal" },
    TEACHER: { bg: "var(--success)", color: "#fff", label: "Teacher" },
    STUDENT: { bg: "var(--warning)", color: "#fff", label: "Student" },
    PARENT: { bg: "var(--slate-500)", color: "#fff", label: "Parent" },
  };
  const badge = roleBadgeColors[currentUser?.role || ""] || { bg: "var(--slate-400)", color: "#fff", label: currentUser?.role || "" };
  const initials = `${profileForm.firstName?.charAt(0) || ""}${profileForm.lastName?.charAt(0) || ""}`.toUpperCase() || currentUser?.firstName?.charAt(0) || "U";

  return (
    <>
      <Toast msg={msg} onClose={() => setMsg(null)} />

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .settings-tab-btn:hover { background: var(--bg-surface-hover) !important; color: var(--text-primary) !important; }
        .settings-tab-btn.active { background: var(--primary-50) !important; color: var(--primary-700) !important; border-color: var(--primary-200) !important; }
        .settings-content { animation: fadeSlideIn 0.25s ease; }
        .ay-row:hover { border-color: var(--primary-300) !important; box-shadow: 0 2px 12px rgba(37,99,235,0.06); }
        .fh-card:hover { box-shadow: var(--shadow-e2); transform: translateY(-1px); }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "1200px", margin: "0 auto", width: "100%" }}>
        {/* ── Page Header ─────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Settings</h1>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: "0.2rem" }}>Manage your account and system configuration</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "0.625rem",
              padding: "0.5rem 1rem", borderRadius: "var(--radius-full)",
              background: badge.bg, color: badge.color,
              fontSize: "var(--text-xs)", fontWeight: 700, letterSpacing: "0.06em",
              textTransform: "uppercase", boxShadow: "var(--shadow-e1)",
            }}>
              <ShieldAlert size={14} />
              {badge.label}
            </div>
          </div>
        </div>

        {/* ── Layout ──────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>
          
          {/* ── Sidebar ─────────────────────────────────────────── */}
          <div style={{
            width: "240px", flexShrink: 0,
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-xl)",
            padding: "0.75rem",
            position: "sticky", top: "1rem",
          }}>
            {/* Avatar mini card */}
            <div style={{
              display: "flex", alignItems: "center", gap: "0.75rem",
              padding: "0.875rem 0.75rem", marginBottom: "0.75rem",
              borderRadius: "var(--radius-lg)", background: "var(--bg-app)",
              border: "1px solid var(--border-light)",
            }}>
              <div style={{
                width: "40px", height: "40px", borderRadius: "50%",
                background: profileForm.avatarUrl ? "transparent" : "var(--brand-gradient)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 700, fontSize: "var(--text-sm)", flexShrink: 0, overflow: "hidden",
              }}>
                {profileForm.avatarUrl ? <img src={profileForm.avatarUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : initials}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {profileForm.firstName || currentUser?.firstName} {profileForm.lastName || currentUser?.lastName}
                </p>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {profileForm.email || currentUser?.email}
                </p>
              </div>
            </div>

            {/* Groups */}
            {hasGlobalAccess && (
              <div style={{ marginBottom: "0.5rem" }}>
                <p style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.1em", textTransform: "uppercase", padding: "0.25rem 0.75rem 0.5rem" }}>
                  Administration
                </p>
                {adminTabs.map(t => {
                  const Icon = t.icon;
                  const isActive = tab === t.key;
                  return (
                    <button key={t.key} onClick={() => setTab(t.key as SettingsTab)}
                      className={`settings-tab-btn ${isActive ? "active" : ""}`}
                      style={{
                        display: "flex", alignItems: "center", gap: "0.625rem",
                        width: "100%", padding: "0.625rem 0.75rem",
                        border: "1px solid transparent",
                        borderRadius: "var(--radius-md)", background: "none",
                        cursor: "pointer", fontSize: "var(--text-sm)", fontWeight: isActive ? 600 : 500,
                        color: isActive ? "var(--primary-700)" : "var(--text-secondary)",
                        transition: "all 0.15s", textAlign: "left", marginBottom: "2px",
                      }}>
                      <Icon size={16} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.7 }} />
                      {t.label}
                      {isActive && <ChevronRight size={14} style={{ marginLeft: "auto", opacity: 0.5 }} />}
                    </button>
                  );
                })}
              </div>
            )}

            <div>
              <p style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.1em", textTransform: "uppercase", padding: "0.25rem 0.75rem 0.5rem" }}>
                Personal
              </p>
              {personalTabs.map(t => {
                const Icon = t.icon;
                const isActive = tab === t.key;
                return (
                  <button key={t.key} onClick={() => setTab(t.key as SettingsTab)}
                    className={`settings-tab-btn ${isActive ? "active" : ""}`}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.625rem",
                      width: "100%", padding: "0.625rem 0.75rem",
                      border: "1px solid transparent",
                      borderRadius: "var(--radius-md)", background: "none",
                      cursor: "pointer", fontSize: "var(--text-sm)", fontWeight: isActive ? 600 : 500,
                      color: isActive ? "var(--primary-700)" : "var(--text-secondary)",
                      transition: "all 0.15s", textAlign: "left", marginBottom: "2px",
                    }}>
                    <Icon size={16} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.7 }} />
                    {t.label}
                    {isActive && <ChevronRight size={14} style={{ marginLeft: "auto", opacity: 0.5 }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Main Content ─────────────────────────────────────── */}
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* ── My Profile ───────────────────────────────────── */}
            {tab === "profile" && (
              <div className="settings-content" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {/* Avatar Card */}
                <SettingsCard>
                  <div style={{ display: "flex", alignItems: "center", gap: "2rem", flexWrap: "wrap" }}>
                    {/* Avatar */}
                    <div
                      style={{ position: "relative", cursor: "pointer", flexShrink: 0 }}
                      onMouseEnter={() => setAvatarHover(true)}
                      onMouseLeave={() => setAvatarHover(false)}
                    >
                      <div style={{
                        width: "100px", height: "100px", borderRadius: "50%",
                        border: "3px solid var(--border-default)",
                        overflow: "hidden", position: "relative",
                        background: "var(--brand-gradient)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontWeight: 800, fontSize: "2rem",
                        boxShadow: "var(--shadow-e2)",
                      }}>
                        {profileForm.avatarUrl
                          ? <img src={profileForm.avatarUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="Avatar" />
                          : initials
                        }
                        {avatarHover && (
                          <div style={{
                            position: "absolute", inset: 0,
                            background: "rgba(0,0,0,0.55)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <Camera size={22} color="#fff" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ flex: 1, minWidth: "260px" }}>
                      <p style={{ fontWeight: 700, fontSize: "var(--text-lg)", color: "var(--text-primary)", marginBottom: "0.25rem" }}>
                        {profileForm.firstName} {profileForm.lastName}
                      </p>
                      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "1rem" }}>
                        {profileForm.email}
                      </p>
                      <Input
                        label="Profile Picture URL"
                        placeholder="https://example.com/your-avatar.jpg"
                        value={profileForm.avatarUrl}
                        onChange={e => setProfileForm(f => ({ ...f, avatarUrl: e.target.value }))}
                        leftIcon={<Camera size={16} />}
                      />
                      <p style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginTop: "0.375rem" }}>
                        Paste a public image URL to update your profile photo
                      </p>
                    </div>
                  </div>
                </SettingsCard>

                {/* Info Card */}
                <SettingsCard>
                  <SectionHeader title="Personal Information" subtitle="Update your name and contact details" />
                  <FormRow cols={2}>
                    <Input label="First Name" value={profileForm.firstName} onChange={e => setProfileForm(f => ({ ...f, firstName: e.target.value }))} leftIcon={<User size={15} />} />
                    <Input label="Last Name" value={profileForm.lastName} onChange={e => setProfileForm(f => ({ ...f, lastName: e.target.value }))} leftIcon={<User size={15} />} />
                    <Input label="Email Address" value={profileForm.email} disabled leftIcon={<Mail size={15} />} style={{ opacity: 0.6 }} />
                    <Input label="Phone Number" value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} leftIcon={<Phone size={15} />} />
                  </FormRow>
                  <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end" }}>
                    <Button isLoading={savingProfile} onClick={handleSaveProfile}>
                      <Save size={16} /> Save Profile
                    </Button>
                  </div>
                </SettingsCard>
              </div>
            )}

            {/* ── Preferences ──────────────────────────────────── */}
            {tab === "preferences" && (
              <div className="settings-content" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <SettingsCard>
                  <SectionHeader title="Notification Preferences" subtitle="Control how and when you receive alerts and updates" />
                  {[
                    { key: "emailNotif", label: "Email Notifications", desc: "Receive fee reminders, attendance alerts and academic updates via email", icon: Mail },
                    { key: "smsNotif", label: "SMS Notifications", desc: "Get critical alerts like attendance drops directly on your phone", icon: Phone },
                    { key: "weeklyReport", label: "Weekly Performance Report", desc: "Automated weekly digest summarizing key metrics for your role", icon: Bell },
                  ].map(item => {
                    const Icon = item.icon;
                    const checked = prefs[item.key as keyof typeof prefs];
                    return (
                      <div key={item.key} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem",
                        padding: "1.125rem 0",
                        borderBottom: "1px solid var(--border-light)",
                      }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem" }}>
                          <div style={{
                            width: "36px", height: "36px", borderRadius: "var(--radius-md)",
                            background: "var(--primary-50)", display: "flex", alignItems: "center", justifyContent: "center",
                            color: "var(--primary-600)", flexShrink: 0,
                          }}>
                            <Icon size={18} />
                          </div>
                          <div>
                            <p style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{item.label}</p>
                            <p style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: "0.2rem", lineHeight: 1.5 }}>{item.desc}</p>
                          </div>
                        </div>
                        <ToggleSwitch checked={checked} onChange={v => setPrefs(p => ({ ...p, [item.key]: v }))} />
                      </div>
                    );
                  })}
                </SettingsCard>
              </div>
            )}

            {/* ── Security ─────────────────────────────────────── */}
            {tab === "security" && (
              <div className="settings-content" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <SettingsCard>
                  <SectionHeader title="Change Password" subtitle="Keep your account secure with a strong password" />
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "480px" }}>
                    <Input label="Current Password" type="password" placeholder="Enter current password" value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} leftIcon={<Lock size={15} />} />
                    <Input label="New Password" type="password" placeholder="Minimum 8 characters" value={pwForm.next} onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))} leftIcon={<Key size={15} />} />
                    <Input label="Confirm New Password" type="password" placeholder="Repeat new password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} leftIcon={<Key size={15} />} />
                    <div style={{ paddingTop: "0.5rem" }}>
                      <Button isLoading={savingPw}>Update Password</Button>
                    </div>
                  </div>
                </SettingsCard>

                <SettingsCard>
                  <SectionHeader title="Active Sessions" subtitle="Devices currently signed in to your account" />
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1rem", background: "var(--bg-app)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}>
                    <div style={{ width: "40px", height: "40px", borderRadius: "var(--radius-md)", background: "var(--success-light)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--success)", flexShrink: 0 }}>
                      <Check size={20} />
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>This device — {typeof window !== "undefined" ? navigator.platform : "Windows"}</p>
                      <p style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>Active now · Sunrise School ERP</p>
                    </div>
                    <span style={{ marginLeft: "auto", padding: "0.25rem 0.75rem", borderRadius: "var(--radius-full)", background: "var(--success-light)", color: "var(--success)", fontSize: "var(--text-xs)", fontWeight: 700 }}>Current</span>
                  </div>
                </SettingsCard>
              </div>
            )}

            {/* ── School Config ─────────────────────────────────── */}
            {tab === "school" && hasGlobalAccess && (
              <div className="settings-content" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <SettingsCard>
                  <SectionHeader title="School Profile" subtitle="Core identity, contact details and affiliation settings" />
                  {!school ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "var(--text-secondary)", padding: "2rem 0" }}>
                      <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /> Loading...
                    </div>
                  ) : (
                    <>
                      <FormRow cols={2}>
                        <Input label="School Name" value={schoolForm.name || ""} onChange={e => setSchoolForm((f: any) => ({ ...f, name: e.target.value }))} leftIcon={<Building2 size={15} />} />
                        <Input label="Registration Code" value={schoolForm.code || ""} disabled style={{ opacity: 0.6 }} leftIcon={<Info size={15} />} />
                        <Input label="Contact Phone" value={schoolForm.phone || ""} onChange={e => setSchoolForm((f: any) => ({ ...f, phone: e.target.value }))} leftIcon={<Phone size={15} />} />
                        <Input label="Official Email" value={schoolForm.email || ""} onChange={e => setSchoolForm((f: any) => ({ ...f, email: e.target.value }))} leftIcon={<Mail size={15} />} />
                        <Input label="City" value={schoolForm.city || ""} onChange={e => setSchoolForm((f: any) => ({ ...f, city: e.target.value }))} />
                        <Input label="State" value={schoolForm.state || ""} onChange={e => setSchoolForm((f: any) => ({ ...f, state: e.target.value }))} />
                      </FormRow>
                      <div style={{ marginTop: "1.25rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                        <label style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-secondary)" }}>Board / Affiliation</label>
                        <select
                          value={schoolForm.boardType || ""}
                          onChange={e => setSchoolForm((f: any) => ({ ...f, boardType: e.target.value }))}
                          className="input"
                          style={{ maxWidth: "300px" }}
                          disabled={!isAdmin}
                        >
                          <option value="">Select Board</option>
                          {["CBSE", "ICSE", "State Board", "IB", "Cambridge"].map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>
                      {isAdmin && (
                        <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end" }}>
                          <Button isLoading={savingSchool} onClick={handleSaveSchool}>
                            <Save size={16} /> Save Configuration
                          </Button>
                        </div>
                      )}
                      {isPrincipal && !isAdmin && (
                        <p style={{ marginTop: "1rem", fontSize: "var(--text-xs)", color: "var(--text-tertiary)", padding: "0.625rem 0.875rem", background: "var(--bg-app)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-light)" }}>
                          ℹ️ You have read-only access to school configuration. Contact your School Admin to make changes.
                        </p>
                      )}
                    </>
                  )}
                </SettingsCard>
              </div>
            )}

            {/* ── Curriculum & Board Management ─────────────────── */}
            {tab === "curriculum" && hasGlobalAccess && (
              <div className="settings-content" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <CurriculumManager onToast={(text, type) => showMsg(text, type)} />
              </div>
            )}

            {/* ── Academic Years ────────────────────────────────── */}
            {tab === "academic" && hasGlobalAccess && (
              <div className="settings-content" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {isAdmin && (
                  <SettingsCard>
                    <SectionHeader title="Create Academic Year" subtitle="Define a new instructional term for the school" />
                    <FormRow cols={3}>
                      <Input label="Term Name *" placeholder="e.g. 2026-27" value={ayForm.name} onChange={e => setAyForm(f => ({ ...f, name: e.target.value }))} />
                      <Input label="Start Date *" type="date" value={ayForm.startDate} onChange={e => setAyForm(f => ({ ...f, startDate: e.target.value }))} />
                      <Input label="End Date *" type="date" value={ayForm.endDate} onChange={e => setAyForm(f => ({ ...f, endDate: e.target.value }))} />
                    </FormRow>
                    <div style={{ marginTop: "1.25rem" }}>
                      <Button isLoading={creatingAY} onClick={handleCreateAY} variant="outline">
                        <Plus size={16} /> Create Term
                      </Button>
                    </div>
                  </SettingsCard>
                )}

                <SettingsCard>
                  <SectionHeader title="Academic Terms" subtitle={`${academicYears.length} terms defined`} />
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {academicYears.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-tertiary)" }}>
                        <GraduationCap size={40} style={{ marginBottom: "0.75rem", opacity: 0.4 }} />
                        <p style={{ fontSize: "var(--text-sm)" }}>No academic years created yet</p>
                      </div>
                    ) : academicYears.map((ay: any) => (
                      <div key={ay.id} className="ay-row" style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "1rem 1.25rem",
                        background: ay.isActive ? "var(--primary-50)" : "var(--bg-surface-solid)",
                        borderRadius: "var(--radius-lg)",
                        border: `1.5px solid ${ay.isActive ? "var(--primary-300)" : "var(--border-default)"}`,
                        transition: "all 0.2s",
                      }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                            <p style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{ay.name}</p>
                            {ay.isActive && (
                              <span style={{ padding: "0.125rem 0.625rem", borderRadius: "var(--radius-full)", background: "var(--primary-600)", color: "#fff", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                                Active
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: "0.25rem" }}>
                            {new Date(ay.startDate).toLocaleDateString("en-IN")} — {new Date(ay.endDate).toLocaleDateString("en-IN")}
                          </p>
                        </div>
                        {!ay.isActive && isAdmin && (
                          <Button onClick={() => handleActivateAY(ay.id)} isLoading={activating === ay.id} variant="outline" size="sm">
                            Set Active
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </SettingsCard>
              </div>
            )}

            {/* ── Fee Components ────────────────────────────────── */}
            {tab === "feeheads" && isAdmin && (
              <div className="settings-content" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <SettingsCard>
                  <SectionHeader title="Add Fee Component" subtitle="Define individual billing heads used in fee structures" />
                  <FormRow cols={2}>
                    <Input label="Component Name *" placeholder="e.g. Lab Fee, Sports Fee" value={fhForm.name} onChange={e => setFhForm(f => ({ ...f, name: e.target.value }))} />
                    <Input label="Description" placeholder="Optional — short description" value={fhForm.description} onChange={e => setFhForm(f => ({ ...f, description: e.target.value }))} />
                  </FormRow>
                  <div style={{ marginTop: "1.25rem" }}>
                    <Button isLoading={creatingFH} onClick={handleCreateFH} variant="outline">
                      <Plus size={16} /> Add Component
                    </Button>
                  </div>
                </SettingsCard>

                <SettingsCard>
                  <SectionHeader title="Fee Components" subtitle={`${feeHeads.length} components configured`} />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.875rem" }}>
                    {feeHeads.length === 0 ? (
                      <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "3rem", color: "var(--text-tertiary)" }}>
                        <CreditCard size={40} style={{ marginBottom: "0.75rem", opacity: 0.4 }} />
                        <p style={{ fontSize: "var(--text-sm)" }}>No fee components defined</p>
                      </div>
                    ) : feeHeads.map((fh: any) => (
                      <div key={fh.id} className="fh-card" style={{
                        padding: "1rem 1.25rem",
                        background: "var(--bg-surface-solid)",
                        borderRadius: "var(--radius-lg)",
                        border: "1px solid var(--border-default)",
                        transition: "all 0.2s",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <p style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{fh.name}</p>
                            {fh.description && <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: "0.25rem" }}>{fh.description}</p>}
                          </div>
                          <span style={{
                            padding: "0.2rem 0.625rem", borderRadius: "var(--radius-full)",
                            background: fh.isActive ? "var(--success-light)" : "var(--bg-app)",
                            color: fh.isActive ? "var(--success)" : "var(--text-tertiary)",
                            fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                            border: `1px solid ${fh.isActive ? "var(--success)" : "var(--border-default)"}`,
                            flexShrink: 0, marginLeft: "0.5rem",
                          }}>
                            {fh.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </SettingsCard>
              </div>
            )}

            {/* ── Users ─────────────────────────────────────────── */}
            {tab === "users" && hasGlobalAccess && (
              <div className="settings-content">
                <SettingsCard style={{ textAlign: "center", padding: "4rem 2rem" }}>
                  <div style={{ width: "72px", height: "72px", borderRadius: "var(--radius-xl)", background: "var(--brand-gradient-soft)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem", border: "1px solid var(--primary-200)" }}>
                    <Users size={32} style={{ color: "var(--primary-600)" }} />
                  </div>
                  <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
                    User Directory
                  </h2>
                  <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", maxWidth: "420px", margin: "0 auto 2rem", lineHeight: 1.7 }}>
                    User management is distributed across dedicated directory portals to efficiently handle the scale of your institution.
                  </p>
                  <div style={{ display: "flex", gap: "0.875rem", justifyContent: "center", flexWrap: "wrap" }}>
                    <Button onClick={() => window.location.href = "/students"}>
                      <GraduationCap size={16} /> Student Directory
                    </Button>
                    <Button onClick={() => window.location.href = "/staff"} variant="outline">
                      <UserCog size={16} /> Staff Directory
                    </Button>
                  </div>
                </SettingsCard>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
