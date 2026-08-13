"use client";

import { Bell, Search, LogOut, Moon, Sun, Check, MessageSquare } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { useThemeStore } from "@/store/theme.store";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/axios";
import GlobalSearch from "./GlobalSearch";

export default function Header() {
  const { logout, user } = useAuthStore();
  const router = useRouter();
  const { theme, toggleTheme, setTheme } = useThemeStore();
  
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    // Keyboard shortcut for search
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    // Initial theme setup
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = savedTheme || (prefersDark ? "dark" : "light");
    setTheme(initialTheme);

    // Fetch notifications if logged in
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 60000); // Poll every 60s
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const [notifsRes, countRes] = await Promise.all([
        apiClient.get("/notifications?limit=10"),
        apiClient.get("/notifications/count")
      ]);
      setNotifications(notifsRes.data.data || notifsRes.data || []);
      setUnreadCount(countRes.data.count || countRes.data.data?.count || 0);
    } catch (e) {
      // Ignore errors (e.g. 401) to prevent Next.js dev overlay from popping up
    }
  };

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiClient.patch("/notifications/read-all");
      fetchNotifications();
    } catch {}
  };

  const handleNotificationClick = async (id: string, actionUrl?: string) => {
    try {
      await apiClient.patch(`/notifications/${id}/read`);
      fetchNotifications();
      setShowDropdown(false);
      if (actionUrl) router.push(actionUrl);
    } catch {}
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header className="header" style={{ position: "relative" }}>
      <div className="header-left" style={{ flex: 1 }}>
        <button 
          className="search-bar" 
          onClick={() => setIsSearchOpen(true)}
          style={{ cursor: "pointer", textAlign: "left" }}
        >
          <Search size={18} style={{ color: "var(--text-tertiary)" }} />
          <span style={{ flex: 1, fontSize: "0.875rem" }}>Search students, staff, classes...</span>
          <span style={{ fontSize: "0.7rem", background: "var(--bg-elevated)", padding: "0.2rem 0.4rem", borderRadius: "4px", border: "1px solid var(--border-default)" }}>⌘K</span>
        </button>
      </div>

      <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button 
          onClick={toggleTheme}
          className="btn-ghost btn-icon" 
          title="Toggle Theme"
        >
          {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
        </button>

        {/* Notifications Dropdown */}
        <div style={{ position: 'relative' }}>
          <button 
            className="btn-ghost btn-icon" 
            style={{ position: 'relative' }}
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span style={{ 
                position: 'absolute', top: '2px', right: '4px', width: '10px', height: '10px', 
                backgroundColor: 'var(--danger)', borderRadius: '50%',
                border: '2px solid var(--bg-surface)'
              }}></span>
            )}
          </button>

          {showDropdown && (
            <>
              <div 
                style={{ position: "fixed", inset: 0, zIndex: 90 }} 
                onClick={() => setShowDropdown(false)}
              />
              <div style={{
                position: "absolute", top: "calc(100% + 0.5rem)", right: 0,
                width: "320px", background: "var(--bg-elevated)", border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)", zIndex: 100,
                display: "flex", flexDirection: "column", overflow: "hidden"
              }}>
                <div style={{ padding: "1rem", borderBottom: "1px solid var(--border-default)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-surface)" }}>
                  <span style={{ fontWeight: "var(--font-semibold)", fontSize: "var(--text-sm)" }}>Notifications ({unreadCount})</span>
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead} style={{ background: "none", border: "none", color: "var(--brand-primary)", fontSize: "var(--text-xs)", cursor: "pointer", fontWeight: "var(--font-medium)" }}>
                      Mark all read
                    </button>
                  )}
                </div>
                <div style={{ maxHeight: "360px", overflowY: "auto" }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: "2rem 1rem", textAlign: "center", color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
                      <MessageSquare size={24} style={{ opacity: 0.5, margin: "0 auto 0.5rem" }} />
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div 
                        key={n.id} 
                        onClick={() => handleNotificationClick(n.id, n.actionUrl)}
                        style={{ 
                          padding: "1rem", borderBottom: "1px solid var(--border-subtle)", 
                          background: n.isRead ? "transparent" : "var(--brand-primary-light)",
                          cursor: "pointer", transition: "background var(--duration-fast)",
                          opacity: n.isRead ? 0.7 : 1
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                          <span style={{ fontWeight: "600", fontSize: "0.875rem" }}>{n.title}</span>
                          {!n.isRead && <span style={{ width: "8px", height: "8px", background: "var(--primary-500)", borderRadius: "50%", flexShrink: 0, marginTop: "4px", boxShadow: "0 0 8px var(--primary-500)" }} />}
                        </div>
                        <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginBottom: "0.5rem", lineHeight: 1.4 }}>{n.message}</p>
                        <span style={{ fontSize: "0.65rem", color: "var(--text-tertiary)" }}>{new Date(n.createdAt).toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ height: '32px', width: '1px', backgroundColor: 'var(--border-light)' }}></div>

        <button 
          onClick={handleLogout}
          className="btn-ghost" 
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)' }}
        >
          <LogOut size={18} />
          <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Logout</span>
        </button>
      </div>
      
      <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </header>
  );
}
