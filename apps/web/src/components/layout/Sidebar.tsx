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
  School,
  BrainCircuit,
  BarChart3,
  UserCog,
  CalendarDays,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import { useAuthStore } from "@/store/auth.store";

type UserRole = "SUPER_ADMIN" | "SCHOOL_ADMIN" | "PRINCIPAL" | "TEACHER" | "STUDENT" | "PARENT";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER", "STUDENT", "PARENT"] },
  { label: "Students", href: "/students", icon: GraduationCap, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"] },
  { label: "Admissions", href: "/admissions", icon: UserPlus, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] },
  { label: "Staff", href: "/staff", icon: Users, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] },
  { label: "Attendance", href: "/attendance", icon: CalendarCheck, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"] },
  { label: "Timetable", href: "/timetable", icon: CalendarDays, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"] },
  { label: "Fees", href: "/fees", icon: CreditCard, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "PARENT"] },
  { label: "Exams", href: "/exams", icon: FileText, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"] },
  { label: "Reports", href: "/reports", icon: BarChart3, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] },
  { label: "Messages", href: "/messages", icon: MessageSquare, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"] },
  { label: "AI Assistant", href: "/ai", icon: BrainCircuit, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"] },
  { label: "Users", href: "/users", icon: UserCog, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] },
  { label: "Settings", href: "/settings", icon: Settings, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER", "PARENT", "STUDENT"] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuthStore();

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`} style={{ position: 'relative' }}>
      <div style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', borderBottom: '1px solid var(--border-light)', gap: '0.5rem' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.125rem', letterSpacing: '-0.02em', overflow: 'hidden', minWidth: 0 }}>
          <div style={{ background: 'var(--brand-gradient)', padding: '0.5rem', borderRadius: '12px', color: 'white', boxShadow: 'var(--shadow-glow)', flexShrink: 0 }}>
            <School size={20} />
          </div>
          {!collapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>AI School ERP</span>}
        </div>

        {/* Toggle button — always visible inside the header */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="btn-ghost btn-icon"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{ padding: '0.375rem', opacity: 0.7, flexShrink: 0, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>


      <div style={{ padding: '1.5rem 1rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', paddingLeft: collapsed ? '0' : '0.75rem', textAlign: collapsed ? 'center' : 'left' }}>
          Menu
        </div>
        
        {NAV_ITEMS.filter(item => !user?.role || item.roles.includes(user.role)).map((item, i) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`animate-fade-in delay-${(i % 5) * 100}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.875rem',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-lg)',
                color: isActive ? 'var(--primary-600)' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'var(--primary-50)' : 'transparent',
                textDecoration: 'none',
                fontWeight: isActive ? 600 : 500,
                justifyContent: collapsed ? 'center' : 'flex-start',
                transition: 'all var(--transition-fast)',
                boxShadow: isActive ? 'inset 4px 0 0 var(--primary-500)' : 'none',
                position: 'relative'
              }}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={20} style={{ color: isActive ? 'var(--primary-600)' : 'inherit', filter: isActive ? 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.5))' : 'none' }} />
              {!collapsed && <span>{item.label}</span>}
              
              {isActive && !collapsed && (
                <div style={{ position: 'absolute', right: '1rem', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary-500)', boxShadow: 'var(--shadow-glow)' }} />
              )}
            </Link>
          );
        })}
      </div>

      <div style={{ padding: '1.25rem', borderTop: '1px solid var(--border-light)', background: 'var(--bg-surface-hover)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--brand-gradient)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0, boxShadow: 'var(--shadow-md)' }}>
            {user?.firstName?.charAt(0) || 'U'}
          </div>
          {!collapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user?.firstName} {user?.lastName}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--primary-500)', fontWeight: 500, textTransform: 'capitalize' }}>
                {user?.role?.toLowerCase().replace('_', ' ')} Account
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Expand button removed — toggle is now always in the header */}
    </aside>
  );
}
