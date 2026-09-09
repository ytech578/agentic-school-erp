"use client";

import { useAuthStore } from "@/store/auth.store";
import { LogOut, Bell, Search, ChevronRight } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/axios";

export default function Header() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      apiClient.get("/messages/unread-count")
        .then(res => {
          const count = res.data?.data?.count ?? res.data?.count ?? 0;
          setUnreadCount(count);
        })
        .catch(() => {});
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  // Generate breadcrumbs from pathname
  const pathSegments = pathname.split('/').filter(Boolean);
  
  return (
    <header className="header">
      {/* Breadcrumbs */}
      <div className="breadcrumb animate-slide-in">
        <Link href="/dashboard" className="breadcrumb-item hover:text-brand transition-colors">
          Home
        </Link>
        {pathSegments.map((segment, index) => {
          const href = `/${pathSegments.slice(0, index + 1).join('/')}`;
          const isLast = index === pathSegments.length - 1;
          const label = segment.charAt(0).toUpperCase() + segment.slice(1);
          
          return (
            <div key={href} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <ChevronRight size={14} className="breadcrumb-sep" />
              {isLast ? (
                <span className="breadcrumb-item" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{label}</span>
              ) : (
                <Link href={href} className="breadcrumb-item hover:text-brand transition-colors">
                  {label}
                </Link>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        {/* Global Search */}
        <div className="search-bar">
          <Search size={16} className="text-tertiary" />
          <input 
            type="text" 
            placeholder="Ask Agentic AI or search..." 
            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.875rem', color: 'var(--text-primary)' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ThemeToggle />
          
          <button 
            className="btn-ghost btn-icon relative" 
            style={{ color: 'var(--text-secondary)', cursor: 'pointer' }}
            onClick={() => router.push('/messages')}
            title="Messages"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="status-dot" style={{ 
                position: 'absolute', top: '0.2rem', right: '0.2rem', 
                background: 'var(--status-danger)', width: '8px', height: '8px', borderRadius: '50%' 
              }}></span>
            )}
          </button>

          <div style={{ width: '1px', height: '24px', background: 'var(--border-default)', margin: '0 0.5rem' }}></div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {user?.firstName} {user?.lastName}
              </span>
              <span className={`role-badge ${user?.role}`}>
                {user?.role?.replace('_', ' ')}
              </span>
            </div>
            
            <button 
              onClick={handleLogout}
              className="btn-outline btn-icon"
              title="Logout"
              style={{ cursor: 'pointer' }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
