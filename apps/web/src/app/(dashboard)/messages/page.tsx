"use client";

import { useAuthStore } from "@/store/auth.store";
import { useState, useEffect, useRef } from "react";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import {
  MessageSquare, Send, Search, Inbox, ArrowLeft, Trash2,
  CheckCheck, Plus, X, Megaphone, Users, Clock, ChevronRight
} from "lucide-react";

type Tab = "inbox" | "sent" | "compose" | "broadcast";

function getInitials(name: string) {
  return name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function MessagesPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>("inbox");
  const [inbox, setInbox] = useState<any[]>([]);
  const [sent, setSent] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Compose form
  const [composeForm, setComposeForm] = useState({ recipientId: "", subject: "", body: "" });
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);

  // Broadcast form
  const [broadcastForm, setBroadcastForm] = useState({ subject: "", body: "", targetRole: "" });
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);

  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showMsg = (text: string, type: "success" | "error") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  };

  useEffect(() => {
    fetchInbox();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (tab === "sent") fetchSent();
  }, [tab]);

  const fetchInbox = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get("/messages/inbox");
      const result = res.data?.data ?? res.data;
      setInbox(Array.isArray(result) ? result : []);
    } catch { setInbox([]); } finally { setIsLoading(false); }
  };

  const fetchSent = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get("/messages/sent");
      const result = res.data?.data ?? res.data;
      setSent(Array.isArray(result) ? result : []);
    } catch { setSent([]); } finally { setIsLoading(false); }
  };

  const fetchUsers = async () => {
    try {
      const res = await apiClient.get("/messages/users");
      const result = res.data?.data ?? res.data;
      setUsers(Array.isArray(result) ? result : []);
    } catch { }
  };

  const openMessage = async (message: any) => {
    setSelected(message);
    if (!message.isRead) {
      try {
        await apiClient.put(`/messages/${message.id}/read`);
        setInbox(prev => prev.map(m => m.id === message.id ? { ...m, isRead: true } : m));
      } catch { }
    }
  };

  const sendReply = async () => {
    if (!replyBody.trim() || !selected) return;
    setSending(true);
    try {
      await apiClient.post("/messages/send", {
        recipientId: selected.senderId,
        subject: `Re: ${selected.subject || "Message"}`,
        body: replyBody,
        parentId: selected.id,
      });
      setReplyBody("");
      showMsg("Reply sent!", "success");
      fetchInbox();
    } catch { showMsg("Failed to send reply.", "error"); } finally { setSending(false); }
  };

  const sendCompose = async () => {
    if (!composeForm.recipientId || !composeForm.body.trim()) return;
    setSending(true);
    try {
      await apiClient.post("/messages/send", composeForm);
      setComposeForm({ recipientId: "", subject: "", body: "" });
      setTab("sent");
      fetchSent();
      showMsg("Message sent!", "success");
    } catch { showMsg("Failed to send message.", "error"); } finally { setSending(false); }
  };

  const sendBroadcast = async () => {
    if (!broadcastForm.subject.trim() || !broadcastForm.body.trim()) return;
    setBroadcasting(true);
    try {
      const res = await apiClient.post("/messages/broadcast", broadcastForm);
      console.log("RAW BROADCAST RES.DATA:", res.data);
      // Depending on interceptors, the 'sent' count could be at various levels
      const payload = res.data?.data ?? res.data;
      const count = payload?.sent ?? res.data?.sent ?? 0;
      setBroadcastResult(`✅ Announcement sent to ${count} recipients!`);
      setBroadcastForm({ subject: "", body: "", targetRole: "" });
    } catch { setBroadcastResult("❌ Failed to send announcement."); } finally { setBroadcasting(false); }
  };

  const deleteMessage = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiClient.delete(`/messages/${id}`);
      setInbox(prev => prev.filter(m => m.id !== id));
      setSent(prev => prev.filter(m => m.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch { showMsg("Failed to delete.", "error"); }
  };

  const markAllRead = async () => {
    await apiClient.put("/messages/read-all");
    fetchInbox();
  };

  const filteredInbox = inbox.filter(m =>
    (m.sender?.firstName + " " + m.sender?.lastName + (m.subject || "")).toLowerCase().includes(search.toLowerCase())
  );
  const filteredSent = sent.filter(m =>
    ((m.subject || "") + (m.body || "")).toLowerCase().includes(search.toLowerCase())
  );

  const ROLE_COLORS: Record<string, string> = {
    TEACHER: "#6366f1", PRINCIPAL: "#0ea5e9", SCHOOL_ADMIN: "#f59e0b",
    STUDENT: "#10b981", PARENT: "#ec4899", SUPER_ADMIN: "#8b5cf6",
  };

  const tabStyle = (active: boolean) => ({
    padding: "0.6rem 1.25rem", borderRadius: "var(--radius-md)", cursor: "pointer",
    fontWeight: active ? 600 : 400, fontSize: "0.875rem",
    background: active ? "var(--brand-primary)" : "transparent",
    color: active ? "#fff" : "var(--text-secondary)", border: "none",
    transition: "all 0.15s",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", height: "calc(100vh - 120px)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)", marginBottom: "0.25rem" }}>
            Messages
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
            {inbox.filter(m => !m.isRead).length} unread messages
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Button variant="outline" onClick={markAllRead} style={{ fontSize: "0.8125rem" }}>
            <CheckCheck size={16} style={{ marginRight: "0.4rem" }} /> Mark all read
          </Button>
          {user?.role !== "STUDENT" && user?.role !== "PARENT" && (
            <Button onClick={() => setTab("compose")}>
              <Plus size={16} style={{ marginRight: "0.4rem" }} /> Compose
            </Button>
          )}
        </div>
      </div>

      {/* Alert */}
      {msg && (
        <div style={{
          padding: "0.75rem 1rem", borderRadius: "var(--radius-md)", flexShrink: 0,
          background: msg.type === "success" ? "var(--success-bg, #dcfce7)" : "var(--danger-bg, #fee2e2)",
          color: msg.type === "success" ? "#166534" : "#991b1b",
          border: `1px solid ${msg.type === "success" ? "#86efac" : "#fca5a5"}`,
        }}>
          {msg.text}
        </div>
      )}

      <div style={{ display: "flex", gap: "1.5rem", flex: 1, overflow: "hidden" }}>
        {/* Left Panel */}
        <div style={{ width: "320px", display: "flex", flexDirection: "column", flexShrink: 0, background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)", overflow: "hidden" }}>
          {/* Tabs */}
          <div style={{ padding: "0.75rem", borderBottom: "1px solid var(--border-default)", display: "flex", gap: "0.5rem" }}>
            <button style={tabStyle(tab === "inbox")} onClick={() => setTab("inbox")}>
              <Inbox size={14} style={{ marginRight: "0.35rem" }} />Inbox
              {inbox.filter(m => !m.isRead).length > 0 && (
                <span style={{ background: "var(--brand-primary)", color: "#fff", borderRadius: "999px", fontSize: "0.7rem", padding: "0.1rem 0.4rem", marginLeft: "0.35rem" }}>
                  {inbox.filter(m => !m.isRead).length}
                </span>
              )}
            </button>
            <button style={tabStyle(tab === "sent")} onClick={() => setTab("sent")}>Sent</button>
            {user?.role !== "STUDENT" && user?.role !== "PARENT" && (
              <button style={tabStyle(tab === "broadcast")} onClick={() => setTab("broadcast")}>
                <Megaphone size={14} style={{ marginRight: "0.35rem" }} />
              </button>
            )}
          </div>

          {/* Search */}
          <div style={{ padding: "0.75rem", borderBottom: "1px solid var(--border-default)" }}>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search messages..."
                style={{ width: "100%", padding: "0.5rem 0.75rem 0.5rem 2.25rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-app)", color: "var(--text-primary)", fontSize: "0.8125rem", outline: "none" }}
              />
            </div>
          </div>

          {/* Message List */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {isLoading ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-tertiary)" }}>Loading...</div>
            ) : (tab === "inbox" ? filteredInbox : filteredSent).length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-tertiary)" }}>
                <MessageSquare size={32} style={{ margin: "0 auto 1rem", opacity: 0.3 }} />
                <p>No messages yet</p>
              </div>
            ) : (
              (tab === "inbox" ? filteredInbox : filteredSent).map(m => (
                <div
                  key={m.id}
                  onClick={() => openMessage(m)}
                  style={{
                    padding: "1rem", borderBottom: "1px solid var(--border-light)",
                    cursor: "pointer", position: "relative",
                    background: selected?.id === m.id ? "var(--bg-active, rgba(99,102,241,0.08))" : (m.isRead === false ? "rgba(99,102,241,0.04)" : "transparent"),
                    transition: "background 0.15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                    <div style={{
                      width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0,
                      background: ROLE_COLORS[m.sender?.role || "TEACHER"] + "22",
                      color: ROLE_COLORS[m.sender?.role || "TEACHER"],
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 700, fontSize: "0.75rem",
                    }}>
                      {getInitials(`${m.sender?.firstName} ${m.sender?.lastName}`)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
                        <span style={{ fontWeight: m.isRead === false ? 700 : 500, fontSize: "0.8125rem", color: "var(--text-primary)" }}>
                          {tab === "inbox" ? `${m.sender?.firstName} ${m.sender?.lastName}` : "To: " + m.recipientId?.slice(0, 8)}
                        </span>
                        <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)" }}>{formatTime(m.createdAt)}</span>
                      </div>
                      <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {m.subject || "(No subject)"}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {m.body}
                      </div>
                    </div>
                    {m.isRead === false && (
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--brand-primary)", flexShrink: 0, marginTop: "0.25rem" }} />
                    )}
                  </div>
                  <button onClick={(e) => deleteMessage(m.id, e)} style={{ position: "absolute", right: "0.75rem", bottom: "0.75rem", background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", opacity: 0, transition: "opacity 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = "1")} onMouseLeave={e => (e.currentTarget.style.opacity = "0")}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel */}
        <div style={{ flex: 1, background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* COMPOSE */}
          {tab === "compose" && (
            <div style={{ padding: "2.5rem 3rem", display: "flex", flexDirection: "column", gap: "1.5rem", height: "100%", overflowY: "auto", paddingBottom: "4rem" }}>
              <div style={{ paddingBottom: "1.5rem", borderBottom: "1px solid var(--border-default)", display: "flex", alignItems: "center", gap: "1rem" }}>
                <button onClick={() => setTab("inbox")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)" }}><ArrowLeft size={20} /></button>
                <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700 }}>New Message</h2>
              </div>
              <div>
                <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.4rem" }}>To</label>
                <select
                  value={composeForm.recipientId}
                  onChange={e => setComposeForm(f => ({ ...f, recipientId: e.target.value }))}
                  style={{ width: "100%", padding: "0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-app)", color: "var(--text-primary)", fontSize: "0.875rem", outline: "none" }}
                >
                  <option value="">Select recipient...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role.replace("_", " ")})</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.4rem" }}>Subject</label>
                <input
                  value={composeForm.subject}
                  onChange={e => setComposeForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="Message subject..."
                  style={{ width: "100%", padding: "0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-app)", color: "var(--text-primary)", fontSize: "0.875rem", outline: "none" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.4rem" }}>Message</label>
                <textarea
                  value={composeForm.body}
                  onChange={e => setComposeForm(f => ({ ...f, body: e.target.value }))}
                  placeholder="Write your message here..."
                  style={{ width: "100%", height: "220px", padding: "0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-app)", color: "var(--text-primary)", fontSize: "0.875rem", resize: "vertical", fontFamily: "inherit" }}
                />
              </div>
              <Button onClick={sendCompose} isLoading={sending} style={{ alignSelf: "flex-end", marginTop: "0.5rem" }}>
                <Send size={16} style={{ marginRight: "0.5rem" }} /> Send Message
              </Button>
            </div>
          )}

          {/* BROADCAST */}
          {tab === "broadcast" && (
            <div style={{ padding: "2.5rem 3rem", display: "flex", flexDirection: "column", gap: "1.5rem", height: "100%", overflowY: "auto", paddingBottom: "4rem" }}>
              <div style={{ paddingBottom: "1.5rem", borderBottom: "1px solid var(--border-default)" }}>
                <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                  <Megaphone size={24} style={{ color: "var(--brand-primary)" }} /> Broadcast Announcement
                </h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>Send an announcement to all staff, teachers, or specific roles at once.</p>
              </div>
              
              {broadcastResult && (
                <div style={{ padding: "1rem", borderRadius: "var(--radius-md)", background: "var(--bg-elevated)", border: "1px solid var(--border-default)", fontSize: "0.9375rem" }}>
                  {broadcastResult}
                </div>
              )}
              
              <div>
                <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.4rem" }}>Audience</label>
                <select
                  value={broadcastForm.targetRole}
                  onChange={e => setBroadcastForm(f => ({ ...f, targetRole: e.target.value }))}
                  style={{ width: "100%", padding: "0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-app)", color: "var(--text-primary)", fontSize: "0.875rem", outline: "none" }}
                >
                  <option value="">Everyone</option>
                  <option value="TEACHER">All Teachers</option>
                  <option value="PARENT">All Parents</option>
                  <option value="STUDENT">All Students</option>
                  <option value="SCHOOL_ADMIN">All Admins</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.4rem" }}>Subject</label>
                <input
                  value={broadcastForm.subject}
                  onChange={e => setBroadcastForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="Announcement title..."
                  style={{ width: "100%", padding: "0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-app)", color: "var(--text-primary)", fontSize: "0.875rem", outline: "none" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.4rem" }}>Announcement Body</label>
                <textarea
                  value={broadcastForm.body}
                  onChange={e => setBroadcastForm(f => ({ ...f, body: e.target.value }))}
                  placeholder="Write the announcement details here..."
                  style={{ width: "100%", height: "220px", padding: "0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-app)", color: "var(--text-primary)", fontSize: "0.875rem", resize: "vertical", fontFamily: "inherit" }}
                />
              </div>
              <Button onClick={sendBroadcast} isLoading={broadcasting} style={{ alignSelf: "flex-end", marginTop: "0.5rem" }}>
                <Megaphone size={16} style={{ marginRight: "0.5rem" }} /> Send Announcement
              </Button>
            </div>
          )}

          {/* MESSAGE DETAIL */}
          {selected && (tab === "inbox" || tab === "sent") && (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
              <div style={{ padding: "1.5rem 2rem", borderBottom: "1px solid var(--border-default)", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: "0.5rem" }}>{selected.subject || "(No subject)"}</h2>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                      <span>From: <b>{selected.sender?.firstName} {selected.sender?.lastName}</b></span>
                      <span style={{ color: "var(--text-tertiary)" }}>·</span>
                      <span>{new Date(selected.createdAt).toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: "0.25rem" }}>
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "2rem" }}>
                <p style={{ fontSize: "0.9375rem", lineHeight: 1.7, color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>{selected.body}</p>
                {selected.replies?.length > 0 && (
                  <div style={{ marginTop: "2rem", borderTop: "1px solid var(--border-default)", paddingTop: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                    <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {selected.replies.length} Repl{selected.replies.length === 1 ? "y" : "ies"}
                    </p>
                    {selected.replies.map((r: any) => (
                      <div key={r.id} style={{ padding: "1rem 1.25rem", borderRadius: "var(--radius-md)", background: "var(--bg-elevated)", border: "1px solid var(--border-light)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.8125rem" }}>
                          <b>{r.sender?.firstName} {r.sender?.lastName}</b>
                          <span style={{ color: "var(--text-tertiary)" }}>{formatTime(r.createdAt)}</span>
                        </div>
                        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>{r.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {tab === "inbox" && user?.role !== "STUDENT" && (
                <div style={{ padding: "1.25rem 2rem", borderTop: "1px solid var(--border-default)", flexShrink: 0, display: "flex", gap: "0.75rem", alignItems: "flex-end" }}>
                  <textarea
                    value={replyBody} onChange={e => setReplyBody(e.target.value)}
                    placeholder="Write a reply..."
                    style={{ flex: 1, padding: "0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-app)", color: "var(--text-primary)", fontSize: "0.875rem", resize: "none", height: "72px", fontFamily: "inherit" }}
                    onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) sendReply(); }}
                  />
                  <Button onClick={sendReply} isLoading={sending}>
                    <Send size={16} />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!selected && tab !== "compose" && tab !== "broadcast" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", color: "var(--text-tertiary)" }}>
              <MessageSquare size={48} style={{ opacity: 0.2 }} />
              <p style={{ fontSize: "0.9375rem" }}>Select a message to read</p>
              {user?.role !== "STUDENT" && (
                <Button variant="outline" onClick={() => setTab("compose")}>
                  <Plus size={16} style={{ marginRight: "0.5rem" }} /> Compose New Message
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
