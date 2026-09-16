"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { 
  Search, Users, GraduationCap, DollarSign, X, Calendar, 
  BookOpen, FileText, Settings, Sparkles, MessageSquare, ArrowRight, Layers, Loader2, Shield 
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { apiClient } from "@/lib/axios";
import { isRouteAllowedForRole } from "@/lib/role-routes";

interface SearchItem {
  id: string;
  category: "Navigation" | "Students" | "Staff" | "Finance" | "Academic" | "AI Copilot";
  title: string;
  subtitle: string;
  url: string;
  icon: any;
  roles?: string[];
}

const SYSTEM_SEARCH_ITEMS: SearchItem[] = [
  { id: "nav-dash", category: "Navigation", title: "Main Dashboard", subtitle: "Overview and institutional KPIs", url: "/dashboard", icon: BookOpen },
  { id: "nav-classes", category: "Academic", title: "Classes & Sections", subtitle: "Grade standards, sections and room allocation", url: "/classes", icon: Layers, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"] },
  { id: "nav-students", category: "Students", title: "Students Directory", subtitle: "Profiles, enrollments & attendance", url: "/students", icon: GraduationCap, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"] },
  { id: "nav-attendance", category: "Academic", title: "Daily Attendance", subtitle: "Mark & view student attendance", url: "/attendance", icon: Calendar, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"] },
  { id: "nav-timetable", category: "Academic", title: "Master Timetable", subtitle: "Weekly schedules and periods", url: "/timetable", icon: Calendar, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"] },
  { id: "nav-exams", category: "Academic", title: "Exams & Grading", subtitle: "Report cards, marks & grading rules", url: "/exams", icon: FileText, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"] },
  { id: "nav-copilot", category: "AI Copilot", title: "Teacher AI Copilot", subtitle: "Lesson planning & exam paper helper", url: "/teacher-copilot", icon: Sparkles, roles: ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"] },
  { id: "nav-ai", category: "AI Copilot", title: "AI Assistant", subtitle: "Curriculum and automated assistant", url: "/ai", icon: Sparkles, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"] },
  { id: "nav-staff", category: "Staff", title: "Staff Directory", subtitle: "Faculty, assignments & payroll", url: "/staff", icon: Users, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] },
  { id: "nav-fees", category: "Finance", title: "Fees & Invoices", subtitle: "Fee structures, payments & receipts", url: "/fees", icon: DollarSign, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] },
  { id: "nav-parent-fees", category: "Finance", title: "Parent Fee Portal", subtitle: "Online UPI & card payment gateway", url: "/parent-fees", icon: DollarSign, roles: ["PARENT"] },
  { id: "nav-leaves", category: "Academic", title: "My Leaves & Records", subtitle: "Teacher attendance and leave requests", url: "/hr", icon: Calendar, roles: ["TEACHER"] },
  { id: "nav-principal", category: "Navigation", title: "Principal Command", subtitle: "Executive oversight and approvals", url: "/principal", icon: Shield, roles: ["SUPER_ADMIN", "PRINCIPAL"] },
  { id: "nav-messages", category: "Navigation", title: "Messages & Circulars", subtitle: "Broadcasts, alerts and notifications", url: "/messages", icon: MessageSquare },
  { id: "nav-settings", category: "Navigation", title: "System Settings", subtitle: "School profiles, roles & permissions", url: "/settings", icon: Settings },
];

export default function GlobalSearch({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [liveResults, setLiveResults] = useState<SearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setLiveResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Live entity querying for Students and Staff (strictly role-authorized)
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setLiveResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const userRole = user?.role;
      try {
        const promises: Promise<any>[] = [];
        const canSearchStudents = isRouteAllowedForRole("/students", userRole);
        const canSearchStaff = isRouteAllowedForRole("/staff", userRole);

        if (canSearchStudents) {
          promises.push(
            apiClient.get("/students", { params: { search: trimmed, limit: 4 } })
              .then((res) => ({ type: "students", data: res.data }))
              .catch(() => ({ type: "students", data: null }))
          );
        }

        if (canSearchStaff) {
          promises.push(
            apiClient.get("/staff", { params: { search: trimmed, limit: 4 } })
              .then((res) => ({ type: "staff", data: res.data }))
              .catch(() => ({ type: "staff", data: null }))
          );
        }

        if (promises.length === 0) {
          setLiveResults([]);
          return;
        }

        const responses = await Promise.all(promises);
        const dynamicItems: SearchItem[] = [];

        for (const resp of responses) {
          if (resp?.type === "students" && resp.data?.data?.items) {
            resp.data.data.items.forEach((s: any) => {
              const classInfo = s.enrollments?.[0]?.section?.class?.name
                ? `${s.enrollments[0].section.class.name} - ${s.enrollments[0].section.name}`
                : "Enrolled";
              dynamicItems.push({
                id: `live-std-${s.id}`,
                category: "Students",
                title: `${s.user?.firstName || ''} ${s.user?.lastName || ''}`.trim() || s.admissionNumber,
                subtitle: `Admission No: ${s.admissionNumber} • ${classInfo}`,
                url: `/students/${s.id}`,
                icon: GraduationCap,
              });
            });
          }

          if (resp?.type === "staff" && resp.data?.data?.items) {
            resp.data.data.items.forEach((st: any) => {
              dynamicItems.push({
                id: `live-stf-${st.id}`,
                category: "Staff",
                title: `${st.user?.firstName || ''} ${st.user?.lastName || ''}`.trim() || st.employeeId,
                subtitle: `Employee ID: ${st.employeeId} • ${st.department?.name || st.user?.role || 'Staff'}`,
                url: `/staff/${st.id}`,
                icon: Users,
              });
            });
          }
        }

        setLiveResults(dynamicItems);
      } catch (err) {
        console.error("Live global search error", err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, user?.role]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const userRole = user?.role;

    // Filter available static navigation items by route permissions and role whitelist
    const available = SYSTEM_SEARCH_ITEMS.filter((item) => {
      if (!isRouteAllowedForRole(item.url, userRole)) {
        return false;
      }
      if (item.roles && userRole && !item.roles.includes(userRole)) {
        return false;
      }
      return true;
    });

    // Strictly deduplicate items by URL and ID to prevent duplicates
    const deduplicateItems = (items: SearchItem[]): SearchItem[] => {
      const seenUrls = new Set<string>();
      const seenIds = new Set<string>();
      const result: SearchItem[] = [];

      for (const item of items) {
        if (!isRouteAllowedForRole(item.url, userRole)) {
          continue;
        }

        const normalizedUrl = item.url.trim().toLowerCase();
        if (!seenUrls.has(normalizedUrl) && !seenIds.has(item.id)) {
          seenUrls.add(normalizedUrl);
          seenIds.add(item.id);
          result.push(item);
        }
      }
      return result;
    };

    if (!q) {
      return deduplicateItems(available).slice(0, 8);
    }

    const matchedNav = available.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );

    // Combine static navigation items with live backend entities, strictly deduplicated
    return deduplicateItems([...liveResults, ...matchedNav]);
  }, [query, user?.role, liveResults]);

  const handleSelect = (url: string) => {
    onClose();
    router.push(url);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % (filteredItems.length || 1));
    } else if (e.key === "Enter" && filteredItems[selectedIndex]) {
      e.preventDefault();
      handleSelect(filteredItems[selectedIndex].url);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div 
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.55)",
          zIndex: 1000,
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
        onClick={onClose}
      />
      <div 
        style={{
          position: "fixed", 
          top: "15%", 
          left: "50%", 
          transform: "translate(-50%, 0)", 
          width: "90%", 
          maxWidth: "580px",
          background: "#ffffff", 
          borderRadius: "16px", 
          border: "1px solid #e2e8f0",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.2)", 
          zIndex: 1001,
          overflow: "hidden",
        }}
        onKeyDown={handleKeyDown}
      >
        <div style={{ display: "flex", alignItems: "center", padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
          {isSearching ? (
            <Loader2 className="spin" size={20} color="#2563eb" style={{ marginRight: "0.875rem", flexShrink: 0 }} />
          ) : (
            <Search size={20} color="#64748b" style={{ marginRight: "0.875rem", flexShrink: 0 }} />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Quick search modules, students, fees or settings..."
            style={{ 
              flex: 1, 
              border: "none", 
              background: "transparent", 
              color: "#0f172a", 
              fontSize: "1rem", 
              outline: "none" 
            }}
          />
          <button 
            type="button"
            onClick={onClose} 
            style={{ 
              background: "#f1f5f9", 
              border: "1px solid #e2e8f0", 
              borderRadius: "6px", 
              padding: "0.25rem 0.5rem", 
              fontSize: "0.75rem", 
              color: "#64748b", 
              cursor: "pointer",
              fontWeight: 600
            }}
          >
            ESC
          </button>
        </div>
        
        <div style={{ padding: "0.5rem", maxHeight: "420px", overflowY: "auto" }}>
          {filteredItems.length > 0 ? (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              const IconComp = item.icon;
              return (
                <div 
                  key={item.id}
                  onClick={() => handleSelect(item.url)}
                  style={{
                    display: "flex", 
                    alignItems: "center", 
                    gap: "0.875rem", 
                    padding: "0.75rem 1rem",
                    borderRadius: "10px", 
                    cursor: "pointer", 
                    background: isSelected ? "rgba(37, 99, 235, 0.08)" : "transparent",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div 
                    style={{ 
                      width: "36px", 
                      height: "36px", 
                      borderRadius: "8px", 
                      background: isSelected ? "#2563eb" : "#f1f5f9", 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center", 
                      flexShrink: 0,
                      transition: "background 0.15s ease",
                    }}
                  >
                    <IconComp size={18} color={isSelected ? "#ffffff" : "#475569"} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontWeight: 600, color: "#0f172a", fontSize: "0.875rem" }}>
                        {item.title}
                      </span>
                      <span style={{ fontSize: "0.7rem", color: "#64748b", background: "#f1f5f9", padding: "1px 6px", borderRadius: "4px" }}>
                        {item.category}
                      </span>
                    </div>
                    <div style={{ color: "#64748b", fontSize: "0.75rem", marginTop: "2px" }}>
                      {item.subtitle}
                    </div>
                  </div>
                  {isSelected && (
                    <ArrowRight size={15} color="#2563eb" style={{ flexShrink: 0 }} />
                  )}
                </div>
              );
            })
          ) : (
            <div style={{ padding: "2.5rem 1rem", textAlign: "center", color: "#64748b" }}>
              <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 500 }}>No results found for &ldquo;{query}&rdquo;</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "0.75rem", color: "#94a3b8" }}>Try searching for &lsquo;Students&rsquo;, &lsquo;Fees&rsquo;, &lsquo;Timetable&rsquo; or &lsquo;Exams&rsquo;</p>
            </div>
          )}
        </div>

        <div style={{ padding: "0.6rem 1rem", borderTop: "1px solid #f1f5f9", background: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", color: "#94a3b8" }}>
          <span>Navigation Quick Search</span>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <span>&uarr;&darr; Navigate</span>
            <span>&crarr; Select</span>
            <span>ESC Close</span>
          </div>
        </div>
      </div>
    </>
  );
}
