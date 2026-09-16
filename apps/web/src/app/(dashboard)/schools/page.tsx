"use client";

import React, { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { apiClient } from "@/lib/axios";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  Plus,
  Search,
  Filter,
  Users,
  GraduationCap,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  ExternalLink,
  Edit2,
  Power,
  RefreshCw,
  LayoutGrid,
  List,
  Sparkles,
  School,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { CreateSchoolModal } from "@/components/schools/CreateSchoolModal";
import { EditSchoolModal } from "@/components/schools/EditSchoolModal";

export default function SchoolsManagementPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBoard, setSelectedBoard] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<any | null>(null);

  // Check query params if onboard was requested via url (e.g. /schools?onboard=true)
  useEffect(() => {
    if (searchParams.get("onboard") === "true") {
      setIsCreateModalOpen(true);
    }
  }, [searchParams]);

  const fetchSchools = async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      const res = await apiClient.get("/schools");
      const list = res.data?.data || res.data || [];
      if (Array.isArray(list)) {
        setSchools(list);
      }
    } catch (err) {
      console.error("Failed to load schools fleet:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSchools();
  }, []);

  const handleToggleStatus = async (school: any) => {
    const nextStatus = !school.isActive;
    const actionLabel = nextStatus ? "activate" : "suspend";
    if (!window.confirm(`Are you sure you want to ${actionLabel} ${school.name}?`)) {
      return;
    }

    try {
      await apiClient.patch(`/schools/${school.id}/status`, { isActive: nextStatus });
      setSchools((prev) =>
        prev.map((s) => (s.id === school.id ? { ...s, isActive: nextStatus } : s))
      );
    } catch (err) {
      alert(`Failed to ${actionLabel} school.`);
    }
  };

  const handleSwitchToCampus = (schoolId: string) => {
    localStorage.setItem("selected_school_id", schoolId);
    window.dispatchEvent(new Event("school-context-changed"));
    router.push("/dashboard");
  };

  // Filtered schools
  const filteredSchools = schools.filter((s) => {
    const matchesSearch =
      s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.principalName?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesBoard = selectedBoard === "ALL" || s.boardType === selectedBoard;
    const matchesStatus =
      selectedStatus === "ALL" ||
      (selectedStatus === "ACTIVE" && s.isActive) ||
      (selectedStatus === "SUSPENDED" && !s.isActive);

    return matchesSearch && matchesBoard && matchesStatus;
  });

  // Calculate high-level fleet metrics
  const totalCampuses = schools.length;
  const activeCampuses = schools.filter((s) => s.isActive).length;
  const totalEnrollment = schools.reduce((acc, s) => acc + (s._count?.students || 0), 0);
  const totalStaff = schools.reduce((acc, s) => acc + (s._count?.users || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Fleet Overview Hero Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F2347 100%)",
          borderRadius: "var(--radius-xl)",
          padding: "1.75rem 2rem",
          color: "#FFFFFF",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1.25rem",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ maxWidth: "600px", zIndex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.3rem 0.75rem", borderRadius: "var(--radius-full)", background: "rgba(37, 99, 235, 0.2)", border: "1px solid rgba(37, 99, 235, 0.3)", marginBottom: "0.75rem" }}>
            <Sparkles size={14} style={{ color: "#60A5FA" }} />
            <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "#BFDBFE", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Multi-Tenant Enterprise Fleet
            </span>
          </div>
          <h2 style={{ fontSize: "var(--text-2xl)", fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 0.5rem 0", color: "#FFFFFF" }}>
            Schools & Campuses Management
          </h2>
          <p style={{ color: "#94A3B8", fontSize: "var(--text-sm)", lineHeight: 1.6, margin: 0 }}>
            Unified governance across all onboarded institutions. Onboard new campuses, configure academic years, and seamlessly switch operational context.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", zIndex: 1 }}>
          <button
            onClick={() => fetchSchools(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              color: "#FFFFFF",
              padding: "0.625rem 1rem",
              borderRadius: "var(--radius-lg)",
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
          <Button
            variant="primary"
            onClick={() => setIsCreateModalOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "linear-gradient(135deg, #2563EB 0%, #06B6D4 100%)",
              boxShadow: "0 4px 14px rgba(37, 99, 235, 0.4)",
            }}
          >
            <Plus size={16} />
            Onboard New School
          </Button>
        </div>
      </div>

      {/* Fleet High-Level Telemetry KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem" }}>
        <Card>
          <CardContent style={{ padding: "1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "var(--radius-lg)", background: "rgba(37, 99, 235, 0.1)", color: "var(--primary-600)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Building2 size={24} />
            </div>
            <div>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>Total Campuses</span>
              <h3 style={{ fontSize: "var(--text-2xl)", fontWeight: 800, margin: "0.15rem 0 0", color: "var(--text-primary)" }}>{totalCampuses}</h3>
              <span style={{ fontSize: "11px", color: "var(--status-success)", fontWeight: 600 }}>{activeCampuses} Active Online</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent style={{ padding: "1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "var(--radius-lg)", background: "rgba(16, 185, 129, 0.1)", color: "var(--status-success)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <GraduationCap size={24} />
            </div>
            <div>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>Fleet Enrollment</span>
              <h3 style={{ fontSize: "var(--text-2xl)", fontWeight: 800, margin: "0.15rem 0 0", color: "var(--text-primary)" }}>{totalEnrollment.toLocaleString()}</h3>
              <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Students across all schools</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent style={{ padding: "1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "var(--radius-lg)", background: "rgba(139, 92, 246, 0.1)", color: "#8B5CF6", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users size={24} />
            </div>
            <div>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>Total Staff & Users</span>
              <h3 style={{ fontSize: "var(--text-2xl)", fontWeight: 800, margin: "0.15rem 0 0", color: "var(--text-primary)" }}>{totalStaff.toLocaleString()}</h3>
              <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Faculty and administrators</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent style={{ padding: "1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "var(--radius-lg)", background: "rgba(6, 182, 212, 0.1)", color: "#06B6D4", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>Tenant Isolation</span>
              <h3 style={{ fontSize: "var(--text-2xl)", fontWeight: 800, margin: "0.15rem 0 0", color: "var(--status-success)" }}>100%</h3>
              <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Fail-closed data boundaries</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          background: "var(--bg-surface)",
          padding: "1rem 1.25rem",
          borderRadius: "var(--radius-xl)",
          border: "1px solid var(--border-default)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, minWidth: "280px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "var(--bg-app)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-lg)",
              padding: "0.5rem 0.85rem",
              flex: 1,
            }}
          >
            <Search size={16} style={{ color: "var(--text-tertiary)" }} />
            <input
              type="text"
              placeholder="Search by school name, code, city, principal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: "none",
                background: "none",
                outline: "none",
                fontSize: "var(--text-sm)",
                color: "var(--text-primary)",
                width: "100%",
              }}
            />
          </div>

          <select
            value={selectedBoard}
            onChange={(e) => setSelectedBoard(e.target.value)}
            className="input"
            style={{ width: "auto", minWidth: "140px", fontSize: "var(--text-xs)" }}
          >
            <option value="ALL">All Boards</option>
            <option value="CBSE">CBSE</option>
            <option value="ICSE">ICSE</option>
            <option value="STATE">State Board</option>
            <option value="IB">IB</option>
            <option value="CAMBRIDGE">Cambridge</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="input"
            style={{ width: "auto", minWidth: "130px", fontSize: "var(--text-xs)" }}
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="SUSPENDED">Suspended Only</option>
          </select>
        </div>

        {/* View Mode Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", background: "var(--bg-app)", padding: "0.25rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}>
          <button
            onClick={() => setViewMode("grid")}
            style={{
              border: "none",
              background: viewMode === "grid" ? "var(--bg-surface-solid)" : "transparent",
              color: viewMode === "grid" ? "var(--primary-600)" : "var(--text-tertiary)",
              padding: "0.35rem 0.6rem",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              fontSize: "var(--text-xs)",
              fontWeight: 600,
            }}
          >
            <LayoutGrid size={14} /> Cards
          </button>
          <button
            onClick={() => setViewMode("table")}
            style={{
              border: "none",
              background: viewMode === "table" ? "var(--bg-surface-solid)" : "transparent",
              color: viewMode === "table" ? "var(--primary-600)" : "var(--text-tertiary)",
              padding: "0.35rem 0.6rem",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              fontSize: "var(--text-xs)",
              fontWeight: 600,
            }}
          >
            <List size={14} /> Table
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div style={{ padding: "4rem", textAlign: "center", color: "var(--text-secondary)" }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: "0 auto 1rem" }} />
          <p>Loading multi-school fleet telemetry...</p>
        </div>
      ) : filteredSchools.length === 0 ? (
        <Card>
          <CardContent style={{ padding: "3rem", textAlign: "center" }}>
            <Building2 size={40} style={{ color: "var(--text-tertiary)", margin: "0 auto 1rem" }} />
            <h3 style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              No school campuses match your filter
            </h3>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: "0.5rem" }}>
              Try adjusting your search terms or board filters, or onboard a new institution.
            </p>
            <Button variant="outline" size="sm" onClick={() => setIsCreateModalOpen(true)} style={{ marginTop: "1rem" }}>
              <Plus size={14} style={{ marginRight: "0.35rem" }} /> Onboard New School
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        /* Campus Cards Grid */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1.25rem" }}>
          {filteredSchools.map((school) => (
            <Card
              key={school.id}
              style={{
                display: "flex",
                flexDirection: "column",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
                border: "1px solid var(--border-default)",
              }}
            >
              <CardHeader style={{ padding: "1.25rem", borderBottom: "1px solid var(--border-default)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "0.15rem 0.45rem",
                          borderRadius: "var(--radius-sm)",
                          background: "var(--primary-100)",
                          color: "var(--primary-700)",
                        }}
                      >
                        {school.code}
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "0.15rem 0.45rem",
                          borderRadius: "var(--radius-full)",
                          background: school.isActive ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                          color: school.isActive ? "var(--status-success)" : "var(--status-danger)",
                        }}
                      >
                        {school.isActive ? "Active" : "Suspended"}
                      </span>
                      {school.boardType && (
                        <span style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 600 }}>
                          • {school.boardType}
                        </span>
                      )}
                    </div>

                    <CardTitle
                      style={{
                        fontSize: "var(--text-base)",
                        fontWeight: 800,
                        marginTop: "0.4rem",
                        color: "var(--text-primary)",
                      }}
                    >
                      {school.name}
                    </CardTitle>
                  </div>

                  <button
                    onClick={() => setEditingSchool(school)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--text-tertiary)",
                      cursor: "pointer",
                      padding: "0.35rem",
                      borderRadius: "var(--radius-md)",
                    }}
                    title="Edit Campus Details"
                  >
                    <Edit2 size={15} />
                  </button>
                </div>
              </CardHeader>

              <CardContent style={{ padding: "1.25rem", flex: 1, display: "flex", flexDirection: "column", gap: "1rem" }}>
                {/* Meta details */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <MapPin size={13} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                    <span>
                      {school.city ? `${school.city}, ${school.state || "India"}` : school.address || "Location not set"}
                    </span>
                  </div>
                  {school.principalName && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <GraduationCap size={13} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                      <span>Principal: {school.principalName}</span>
                    </div>
                  )}
                  {school.affiliationNo && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <ShieldCheck size={13} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                      <span>Affiliation: {school.affiliationNo}</span>
                    </div>
                  )}
                </div>

                {/* Sub-metrics */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "0.5rem",
                    padding: "0.75rem",
                    borderRadius: "var(--radius-lg)",
                    background: "var(--bg-app)",
                    border: "1px solid var(--border-default)",
                    textAlign: "center",
                  }}
                >
                  <div>
                    <span style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: 600, display: "block" }}>Students</span>
                    <span style={{ fontSize: "var(--text-sm)", fontWeight: 800, color: "var(--text-primary)" }}>
                      {school._count?.students ?? 0}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: 600, display: "block" }}>Users / Staff</span>
                    <span style={{ fontSize: "var(--text-sm)", fontWeight: 800, color: "var(--text-primary)" }}>
                      {school._count?.users ?? 0}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: 600, display: "block" }}>Depts</span>
                    <span style={{ fontSize: "var(--text-sm)", fontWeight: 800, color: "var(--text-primary)" }}>
                      {school._count?.departments ?? 0}
                    </span>
                  </div>
                </div>

                {/* Card Bottom Actions */}
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "auto", paddingTop: "0.5rem" }}>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleSwitchToCampus(school.id)}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}
                  >
                    Enter Campus <ArrowRight size={13} />
                  </Button>

                  <button
                    onClick={() => handleToggleStatus(school)}
                    style={{
                      border: "1px solid var(--border-default)",
                      background: "var(--bg-surface-solid)",
                      color: school.isActive ? "var(--status-danger)" : "var(--status-success)",
                      borderRadius: "var(--radius-md)",
                      padding: "0 0.6rem",
                      cursor: "pointer",
                      fontSize: "var(--text-xs)",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "0.3rem",
                    }}
                    title={school.isActive ? "Suspend Campus Operations" : "Re-activate Campus Operations"}
                  >
                    <Power size={13} />
                    {school.isActive ? "Suspend" : "Activate"}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Detailed Table View */
        <Card>
          <CardContent style={{ padding: 0 }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "var(--text-xs)" }}>
                <thead>
                  <tr style={{ background: "var(--bg-app)", borderBottom: "1px solid var(--border-default)" }}>
                    <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "var(--text-secondary)" }}>School / Campus</th>
                    <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "var(--text-secondary)" }}>Code</th>
                    <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "var(--text-secondary)" }}>Board</th>
                    <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "var(--text-secondary)" }}>Location</th>
                    <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "var(--text-secondary)" }}>Principal</th>
                    <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "var(--text-secondary)" }}>Students</th>
                    <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "var(--text-secondary)" }}>Status</th>
                    <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "var(--text-secondary)", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSchools.map((s) => (
                    <tr key={s.id} style={{ borderBottom: "1px solid var(--border-default)" }}>
                      <td style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "var(--text-primary)" }}>{s.name}</td>
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <span style={{ fontWeight: 700, color: "var(--primary-600)" }}>{s.code}</span>
                      </td>
                      <td style={{ padding: "0.85rem 1rem", color: "var(--text-secondary)" }}>{s.boardType || "—"}</td>
                      <td style={{ padding: "0.85rem 1rem", color: "var(--text-secondary)" }}>{s.city || s.address || "—"}</td>
                      <td style={{ padding: "0.85rem 1rem", color: "var(--text-secondary)" }}>{s.principalName || "—"}</td>
                      <td style={{ padding: "0.85rem 1rem", fontWeight: 700 }}>{s._count?.students ?? 0}</td>
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "0.15rem 0.45rem",
                            borderRadius: "var(--radius-full)",
                            background: s.isActive ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                            color: s.isActive ? "var(--status-success)" : "var(--status-danger)",
                          }}
                        >
                          {s.isActive ? "Active" : "Suspended"}
                        </span>
                      </td>
                      <td style={{ padding: "0.85rem 1rem", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                          <Button size="sm" variant="ghost" onClick={() => handleSwitchToCampus(s.id)}>
                            Enter Campus
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingSchool(s)}>
                            Edit
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Onboard School Modal */}
      <CreateSchoolModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          fetchSchools(true);
        }}
      />

      {/* Edit School Modal */}
      {editingSchool && (
        <EditSchoolModal
          school={editingSchool}
          isOpen={!!editingSchool}
          onClose={() => setEditingSchool(null)}
          onSaved={(updated) => {
            setSchools((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
          }}
        />
      )}
    </div>
  );
}
