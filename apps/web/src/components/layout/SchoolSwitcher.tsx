"use client";

import React, { useEffect, useState, useRef } from "react";
import { useAuthStore } from "@/store/auth.store";
import { apiClient } from "@/lib/axios";
import {
  Building2,
  ChevronDown,
  Globe,
  Plus,
  Check,
  Search,
  School,
  ExternalLink,
} from "lucide-react";
import { CreateSchoolModal } from "@/components/schools/CreateSchoolModal";
import { useRouter } from "next/navigation";

export default function SchoolSwitcher() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Only render for SUPER_ADMIN
  if (user?.role !== "SUPER_ADMIN") {
    return null;
  }

  const loadSchools = async () => {
    try {
      const res = await apiClient.get("/schools");
      const list = res.data?.data || res.data || [];
      if (Array.isArray(list)) {
        setSchools(list);
      }
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    loadSchools();
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("selected_school_id");
      setSelectedSchoolId(saved || null);
    }
  }, []);

  // Listen for external school context changes
  useEffect(() => {
    const handleContextChange = () => {
      const saved = localStorage.getItem("selected_school_id");
      setSelectedSchoolId(saved || null);
      loadSchools();
    };
    window.addEventListener("school-context-changed", handleContextChange);
    return () => window.removeEventListener("school-context-changed", handleContextChange);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleSelectSchool = (schoolId: string | null) => {
    if (schoolId) {
      localStorage.setItem("selected_school_id", schoolId);
      setSelectedSchoolId(schoolId);
    } else {
      localStorage.removeItem("selected_school_id");
      setSelectedSchoolId(null);
    }

    setIsOpen(false);
    window.dispatchEvent(new Event("school-context-changed"));

    // Reload window or soft refresh router to re-execute data queries with new header
    window.location.reload();
  };

  const currentSchool = schools.find((s) => s.id === selectedSchoolId);

  const filteredSchools = schools.filter(
    (s) =>
      s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ position: "relative" }} ref={dropdownRef}>
      {/* Switcher Button Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.45rem 0.75rem",
          borderRadius: "var(--radius-lg)",
          background: "var(--bg-app)",
          border: "1px solid var(--border-default)",
          color: "var(--text-primary)",
          fontSize: "var(--text-xs)",
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.15s ease",
          maxWidth: "240px",
        }}
        title="Switch school campus context"
      >
        <div
          style={{
            width: "20px",
            height: "20px",
            borderRadius: "var(--radius-sm)",
            background: currentSchool ? "var(--primary-100)" : "rgba(16, 185, 129, 0.15)",
            color: currentSchool ? "var(--primary-600)" : "var(--status-success)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {currentSchool ? <Building2 size={13} /> : <Globe size={13} />}
        </div>

        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            textAlign: "left",
          }}
        >
          {currentSchool ? `${currentSchool.name}` : "Global Fleet (All)"}
        </span>

        {currentSchool && (
          <span
            style={{
              fontSize: "10px",
              padding: "0.1rem 0.35rem",
              borderRadius: "var(--radius-sm)",
              background: "var(--bg-surface-solid)",
              border: "1px solid var(--border-default)",
              color: "var(--text-secondary)",
              fontWeight: 700,
            }}
          >
            {currentSchool.code}
          </span>
        )}

        <ChevronDown size={14} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            width: "300px",
            borderRadius: "var(--radius-xl)",
            background: "var(--bg-surface-solid, #1E293B)",
            border: "1px solid var(--border-default)",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.15)",
            zIndex: 1000,
            overflow: "hidden",
            animation: "fadeIn 0.15s ease-out",
          }}
        >
          {/* Popover Header with Search */}
          <div
            style={{
              padding: "0.75rem",
              borderBottom: "1px solid var(--border-default)",
              background: "var(--bg-surface)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Campus Context Switcher
              </span>
              <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                {schools.length} {schools.length === 1 ? "School" : "Schools"}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.35rem 0.6rem",
                borderRadius: "var(--radius-md)",
                background: "var(--bg-app)",
                border: "1px solid var(--border-default)",
              }}
            >
              <Search size={13} style={{ color: "var(--text-tertiary)" }} />
              <input
                type="text"
                placeholder="Search campus or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: "none",
                  background: "none",
                  outline: "none",
                  fontSize: "var(--text-xs)",
                  color: "var(--text-primary)",
                  width: "100%",
                }}
              />
            </div>
          </div>

          {/* School Options List */}
          <div style={{ maxHeight: "240px", overflowY: "auto", padding: "0.4rem" }}>
            {/* Fleet Wide Option */}
            <button
              type="button"
              onClick={() => handleSelectSchool(null)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.6rem 0.75rem",
                borderRadius: "var(--radius-lg)",
                border: "none",
                background: selectedSchoolId === null ? "rgba(37, 99, 235, 0.1)" : "transparent",
                color: selectedSchoolId === null ? "var(--primary-600)" : "var(--text-primary)",
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.12s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <Globe size={16} style={{ color: "var(--status-success)" }} />
                <div>
                  <div style={{ fontSize: "var(--text-xs)", fontWeight: 700 }}>
                    Global Fleet (All Campuses)
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                    Aggregated telemetry & cross-institution overview
                  </div>
                </div>
              </div>
              {selectedSchoolId === null && <Check size={14} style={{ color: "var(--primary-600)" }} />}
            </button>

            <div style={{ height: "1px", background: "var(--border-default)", margin: "0.35rem 0.5rem" }} />

            {/* Individual Schools */}
            {filteredSchools.map((school) => {
              const isSelected = selectedSchoolId === school.id;
              return (
                <button
                  key={school.id}
                  type="button"
                  onClick={() => handleSelectSchool(school.id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.6rem 0.75rem",
                    borderRadius: "var(--radius-lg)",
                    border: "none",
                    background: isSelected ? "rgba(37, 99, 235, 0.1)" : "transparent",
                    color: isSelected ? "var(--primary-600)" : "var(--text-primary)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.12s ease",
                    marginBottom: "0.2rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", minWidth: 0 }}>
                    <Building2
                      size={16}
                      style={{ color: isSelected ? "var(--primary-600)" : "var(--text-secondary)", flexShrink: 0 }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "var(--text-xs)",
                          fontWeight: 700,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {school.name}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)", display: "flex", gap: "0.4rem" }}>
                        <span>{school.code}</span>
                        {school.city && <span>• {school.city}</span>}
                        {school.boardType && <span>• {school.boardType}</span>}
                      </div>
                    </div>
                  </div>
                  {isSelected && <Check size={14} style={{ color: "var(--primary-600)", flexShrink: 0 }} />}
                </button>
              );
            })}

            {filteredSchools.length === 0 && (
              <div style={{ padding: "1rem", textAlign: "center", fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                No campuses matching "{searchQuery}"
              </div>
            )}
          </div>

          {/* Popover Footer: Onboard School CTA & Manage All */}
          <div
            style={{
              padding: "0.6rem 0.75rem",
              borderTop: "1px solid var(--border-default)",
              background: "var(--bg-surface)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                router.push("/schools");
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-secondary)",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              Manage Fleet <ExternalLink size={11} />
            </button>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsCreateModalOpen(true);
              }}
              style={{
                background: "var(--primary-600)",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "var(--radius-md)",
                padding: "0.3rem 0.6rem",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              <Plus size={12} /> Onboard School
            </button>
          </div>
        </div>
      )}

      {/* Onboard School Modal */}
      <CreateSchoolModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(newSchool) => {
          loadSchools();
          // Optionally switch to the newly created school
          if (newSchool?.id) {
            handleSelectSchool(newSchool.id);
          }
        }}
      />
    </div>
  );
}
