"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/axios";
import { AlertTriangle, Bell, BellOff, X, ChevronRight, RefreshCw } from "lucide-react";

interface AgentAlert {
  id: string;
  type: string;
  title: string;
  description: string;
  actionLabel?: string;
  isRead: boolean;
  createdAt: string;
}

export function ProactiveAlertBar() {
  const [alerts, setAlerts] = useState<AgentAlert[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  // Fetch alerts on mount using an async effect that prevents stale setState
  useEffect(() => {
    let isMounted = true;
    apiClient
      .get("/ai/alerts")
      .then((res) => {
        if (!isMounted) return;
        const data = res.data.data || res.data;
        setAlerts(Array.isArray(data) ? data : data.alerts || []);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const unreadCount = alerts.filter((a) => !a.isRead).length;

  const handleRunMonitoring = async () => {
    setIsRunning(true);
    try {
      await apiClient.post("/ai/alerts/run-monitoring");
      const res = await apiClient.get("/ai/alerts");
      const data = res.data.data || res.data;
      setAlerts(Array.isArray(data) ? data : data.alerts || []);
    } catch {
      // silent
    } finally {
      setIsRunning(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await apiClient.patch(`/ai/alerts/${id}/read`);
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: true } : a)));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await apiClient.patch("/ai/alerts/read-all");
      setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
    } catch {}
  };

  const getSeverityStyle = (type: string) => {
    switch (type) {
      case "CRITICAL":
        return { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)", dot: "#ef4444" };
      case "WARNING":
        return { bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)", dot: "#f59e0b" };
      default:
        return { bg: "rgba(99,102,241,0.1)", border: "rgba(99,102,241,0.3)", dot: "#6366f1" };
    }
  };

  if (alerts.length === 0 && !isRunning)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.875rem 1.25rem",
          background: "var(--bg-surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-default)",
          marginBottom: "1.5rem",
        }}
      >
        <BellOff size={16} color="var(--text-tertiary)" />
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>No proactive alerts</span>
        <button
          onClick={handleRunMonitoring}
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            padding: "0.375rem 0.75rem",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            fontSize: "var(--text-xs)",
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          <RefreshCw size={12} /> Run Monitoring
        </button>
      </div>
    );

  return (
    <div
      style={{
        marginBottom: "1.5rem",
        borderRadius: "var(--radius-lg)",
        border: "1px solid rgba(99,102,241,0.3)",
        overflow: "hidden",
      }}
    >
      {/* Alert bar header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.875rem 1.25rem",
          background: "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.08) 100%)",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <div style={{ position: "relative", display: "flex" }}>
          <Bell size={18} color="var(--brand-primary)" />
          {unreadCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: "-6px",
                right: "-6px",
                background: "#ef4444",
                color: "white",
                fontSize: "10px",
                fontWeight: "bold",
                borderRadius: "50%",
                width: "16px",
                height: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {unreadCount}
            </span>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <span
            style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-semibold)", color: "var(--text-primary)" }}
          >
            Proactive AI Alerts
          </span>
          <span style={{ marginLeft: "0.5rem", fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
            {unreadCount} unread &middot; {alerts.length} total
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {unreadCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleMarkAllRead();
              }}
              style={{
                padding: "0.25rem 0.5rem",
                background: "none",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-sm)",
                fontSize: "var(--text-xs)",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              Mark all read
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRunMonitoring();
            }}
            style={{
              padding: "0.25rem 0.5rem",
              background: "none",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--text-xs)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
          >
            <RefreshCw size={10} className={isRunning ? "animate-spin" : ""} /> Refresh
          </button>
          <ChevronRight
            size={16}
            color="var(--text-tertiary)"
            style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
          />
        </div>
      </div>

      {/* Alert list */}
      {isExpanded && (
        <div style={{ background: "var(--bg-surface)", borderTop: "1px solid var(--border-default)" }}>
          {alerts.map((alert) => {
            const style = getSeverityStyle(alert.type);
            return (
              <div
                key={alert.id}
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  padding: "1rem 1.25rem",
                  background: alert.isRead ? "transparent" : style.bg,
                  borderBottom: "1px solid var(--border-default)",
                  borderLeft: `3px solid ${style.dot}`,
                  opacity: alert.isRead ? 0.65 : 1,
                  transition: "all 0.2s",
                }}
              >
                <AlertTriangle size={16} color={style.dot} style={{ flexShrink: 0, marginTop: "2px" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <p
                      style={{
                        fontSize: "var(--text-sm)",
                        fontWeight: "var(--font-semibold)",
                        color: "var(--text-primary)",
                        marginBottom: "0.25rem",
                      }}
                    >
                      {alert.title}
                    </p>
                    {!alert.isRead && (
                      <button
                        onClick={() => handleMarkRead(alert.id)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--text-tertiary)",
                          padding: "0",
                          flexShrink: 0,
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {alert.description}
                  </p>
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: "0.25rem" }}>
                    {new Date(alert.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}