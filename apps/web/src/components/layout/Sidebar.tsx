"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  CalendarCheck, 
  CreditCard,
  FileText,
  MessageSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  BrainCircuit,
  BarChart3,
  UserCog,
  CalendarDays,
  UserPlus,
  Shield,
  Activity,
  Sparkles,
  Briefcase,
  Bot,
  Bus,
  Bell,
  Award,
  BookMarked,
  ClipboardList,
  TrendingUp,
  HelpCircle,
  Baby
} from "lucide-react";
import { useState } from "react";
import { useAuthStore } from "@/store/auth.store";

type UserRole = "SUPER_ADMIN" | "SCHOOL_ADMIN" | "PRINCIPAL" | "TEACHER" | "STUDENT" | "PARENT";

const NAV_GROUPS = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER", "STUDENT", "PARENT"] },
      { label: "Principal Command", href: "/principal", icon: Shield, roles: ["SUPER_ADMIN", "PRINCIPAL"] },
      { label: "Teacher Copilot", href: "/teacher-copilot", icon: Sparkles, roles: ["TEACHER", "SCHOOL_ADMIN"] },
      { label: "AI Assistant", href: "/ai", icon: BrainCircuit, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"] },
      { label: "Automation Hub", href: "/automation", icon: Bot, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] },
      { label: "Messages", href: "/messages", icon: MessageSquare, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER", "STUDENT", "PARENT"] },
    ]
  },
  {
    label: "Academics",
    items: [
      { label: "Admissions", href: "/admissions", icon: UserPlus, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] },
      { label: "Students", href: "/students", icon: GraduationCap, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"] },
      { label: "Attendance", href: "/attendance", icon: CalendarCheck, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"] },
      { label: "Timetable", href: "/timetable", icon: CalendarDays, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"] },
      { label: "Exams", href: "/exams", icon: FileText, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"] },
      { label: "Activities", href: "/activities", icon: Award, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"] },
    ]
  },
  {
    label: "Finance & Operations",
    items: [
      { label: "Fees", href: "/fees", icon: CreditCard, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] },
      { label: "Fee Portal", href: "/parent-fees", icon: CreditCard, roles: ["PARENT"] },
      { label: "Staff", href: "/staff", icon: Users, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] },
      { label: "HR Management", href: "/hr", icon: Briefcase, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] },
      { label: "My Leaves", href: "/hr", icon: CalendarCheck, roles: ["TEACHER"] },
      { label: "Reports", href: "/reports", icon: BarChart3, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] },
    ]
  },
  {
    label: "System",
    items: [
      { label: "Users", href: "/users", icon: UserCog, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] },
      { label: "Settings", href: "/settings", icon: Settings, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER", "PARENT", "STUDENT"] },
    ]
  }
];

// ─── PARENT PORTAL NAV ──────────────────────────────────────────────────────
const PARENT_NAV = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Children", href: "/parent/children", icon: Baby },
  { label: "Academic Performance", href: "/parent/academics", icon: TrendingUp },
  { label: "Attendance", href: "/parent/attendance", icon: CalendarCheck },
  { label: "Assignments & Homework", href: "/parent/assignments", icon: ClipboardList },
  { label: "Marks & Assessments", href: "/parent/marks", icon: BookMarked },
  { label: "Timetable", href: "/parent/timetable", icon: CalendarDays },
  { label: "Calendar", href: "/parent/calendar", icon: CalendarDays },
  { label: "Fees & Payments", href: "/parent-fees", icon: CreditCard },
  { label: "Announcements", href: "/parent/announcements", icon: Bell },
  { label: "Activities & Achievements", href: "/parent/activities", icon: Award },
  { label: "Documents", href: "/parent/documents", icon: FileText },
  { label: "Reports", href: "/parent/reports", icon: BarChart3 },
  { label: "Settings & Profile", href: "/settings", icon: Settings },
  { label: "Support & Help", href: "/parent/support", icon: HelpCircle },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuthStore();

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div style={{ padding: '1.25rem 1rem', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', gap: '0.5rem', background: 'var(--brand-gradient-vertical)' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 800, color: '#FFFFFF', fontSize: '1.125rem', letterSpacing: '-0.03em', overflow: 'hidden', minWidth: 0, fontFamily: 'var(--font-display)' }}>
          <div style={{ background: 'var(--brand-gradient)', padding: '0.4rem', borderRadius: '10px', color: 'white', boxShadow: 'var(--teal-glow)', flexShrink: 0 }}>
            <Activity size={20} />
          </div>
          {!collapsed && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.1 }}>Agentic School</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--teal-400)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>ERP Platform v2</span>
            </div>
          )}
        </div>

        {/* Toggle button */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="btn-ghost btn-icon"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{ cursor: 'pointer', padding: '0.25rem', opacity: 0.5, flexShrink: 0, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF' }}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <div className="sidebar-scroll" style={{ padding: '1rem 0.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {user?.role === 'PARENT' ? (
          // ─── PARENT PORTAL SIDEBAR ───
          <div className="sidebar-nav-group">
            {!collapsed && (
              <div className="sidebar-nav-group-label">Parent Portal</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {PARENT_NAV.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href + item.label}
                    href={item.href}
                    className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                    title={collapsed ? item.label : undefined}
                    style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
                  >
                    <Icon className="nav-icon" size={20} style={{ flexShrink: 0 }} />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          // ─── STANDARD NAV ───
          NAV_GROUPS.map((group, groupIdx) => {
          const visibleItems = group.items.filter(item => !user?.role || item.roles.includes(user.role));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label} className="sidebar-nav-group">
              {!collapsed && (
                <div className="sidebar-nav-group-label">{group.label}</div>
              )}
              {collapsed && groupIdx > 0 && (
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '1rem 0.5rem' }} />
              )}
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {visibleItems.map((item, i) => {
                  const isActive = pathname.startsWith(item.href);
                  const Icon = item.icon;
                  
                  return (
                    <Link 
                      key={item.href} 
                      href={item.href}
                      className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                      title={collapsed ? item.label : undefined}
                      style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
                    >
                      <Icon className="nav-icon" size={20} style={{ flexShrink: 0 }} />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })
        )}
      </div>

      <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--brand-gradient)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0, boxShadow: 'var(--shadow-e1)' }}>
            {user?.firstName?.charAt(0) || 'U'}
          </div>
          {!collapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F8FAFC', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user?.firstName} {user?.lastName}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--teal-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {user?.role?.replace('_', ' ')}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
