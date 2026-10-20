"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/axios";
import { useAuthStore } from "@/store/auth.store";

type DocumentRecord = { id: string; kind: "student" | "admission"; fileName: string; scanStatus: string; quarantineReason?: string | null; legalHold: boolean; retainedUntil?: string | null };
type SchoolUser = { id: string; email: string; firstName: string; lastName: string };
type AdminSession = { id: string; status: string; deviceInfo?: string; ipAddress?: string; authMethod: string; lastSeenAt: string };
const card: React.CSSProperties = { background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-xl)", padding: "1.5rem", display: "grid", gap: "1rem" };
const errorText = (error: unknown) => (error as { response?: { data?: { message?: string } } }).response?.data?.message || "The security operation could not be completed.";

export function SecurityOperationsPanel() {
  const user = useAuthStore((state) => state.user);
  const allowed = user?.role === "SCHOOL_ADMIN" && Boolean(user.schoolId);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [users, setUsers] = useState<SchoolUser[]>([]);
  const [target, setTarget] = useState("");
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const sessionRequest = useRef(0);
  const [reason, setReason] = useState("");
  const [retentionDate, setRetentionDate] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!allowed) return;
    try {
      const [docs, people] = await Promise.all([apiClient.get("/document-security"), apiClient.get("/users?limit=100")]);
      setDocuments(docs.data.data || []);
      setUsers(people.data.data || []);
    } catch (error) { setNotice(errorText(error)); }
  }, [allowed]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const loadSessions = async (id: string) => {
    const request = ++sessionRequest.current;
    setTarget(id);
    setSessions([]);
    setSessionsLoading(Boolean(id));
    if (!id) return;
    try {
      const response = await apiClient.get(`/enterprise-identity/users/${encodeURIComponent(id)}/sessions`);
      if (request === sessionRequest.current) setSessions(response.data.data || []);
    }
    catch (error) { if (request === sessionRequest.current) setNotice(errorText(error)); }
    finally { if (request === sessionRequest.current) setSessionsLoading(false); }
  };

  const run = async (operation: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setNotice(null);
    try { await operation(); setNotice(success); await load(); if (target) await loadSessions(target); }
    catch (error) { setNotice(errorText(error)); }
    finally { setBusy(false); }
  };

  if (!allowed) return null;
  const validReason = reason.trim().length >= 20;
  return (
    <>
      <section style={card} aria-labelledby="security-operations-heading">
        <h2 id="security-operations-heading">Document security</h2>
        <p>Review scans, rescan quarantined documents, and manage legal holds. Retention dates can only be extended; a document is released only after a clean scan.</p>
        <label htmlFor="security-operation-reason">Reason for this action (at least 20 characters)</label>
        <textarea id="security-operation-reason" className="security-input" maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
        <label htmlFor="document-retention-date">Extend retention until</label>
        <input id="document-retention-date" className="security-input" type="date" value={retentionDate} onChange={(event) => setRetentionDate(event.target.value)} />
        {notice && <p role="status">{notice}</p>}
        <button className="security-link-button" type="button" disabled={busy} onClick={() => void load()}>Refresh document list</button>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead><tr><th>Document</th><th>Scan</th><th>Retention</th><th>Actions</th></tr></thead>
            <tbody>{documents.map((doc) => <tr key={`${doc.kind}-${doc.id}`}>
              <td style={{ padding: ".75rem" }}>{doc.fileName}<small style={{ display: "block" }}>{doc.kind}</small></td>
              <td>{doc.scanStatus}<small style={{ display: "block" }}>{doc.quarantineReason}</small></td>
              <td>{doc.retainedUntil ? new Date(doc.retainedUntil).toLocaleDateString() : "Not set"}<small style={{ display: "block" }}>{doc.legalHold ? "Legal hold active" : "No legal hold"}</small></td>
              <td><div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem" }}>
                <button className="security-link-button" type="button" disabled={busy || !validReason} onClick={() => void run(() => apiClient.post(`/document-security/${doc.kind}/${doc.id}/rescan`, { reason }), "Document rescanned. Review its resulting status.")}>Rescan</button>
                <button className="security-link-button" type="button" disabled={busy || !validReason} onClick={() => void run(() => apiClient.patch(`/document-security/${doc.kind}/${doc.id}/policy`, { legalHold: !doc.legalHold, reason }), "Legal-hold policy updated.")}>{doc.legalHold ? "Release legal hold" : "Apply legal hold"}</button>
                <button className="security-link-button" type="button" disabled={busy || !validReason || !retentionDate} onClick={() => void run(() => apiClient.patch(`/document-security/${doc.kind}/${doc.id}/policy`, { retainedUntil: `${retentionDate}T23:59:59.000Z`, reason }), "Retention date extended.")}>Extend retention</button>
              </div></td>
            </tr>)}</tbody>
          </table>
          {!documents.length && <p>No documents are available for review in this school.</p>}
        </div>
      </section>
      <section style={card} aria-labelledby="session-administration-heading">
        <h2 id="session-administration-heading">School session administration</h2>
        <p>Review a school user’s sessions and revoke access with a recorded reason. Revocation requires an administrator login verified with MFA in the last 10 minutes.</p>
        <label htmlFor="session-admin-user">School user</label>
        <select id="session-admin-user" className="security-input" disabled={busy} value={target} onChange={(event) => void loadSessions(event.target.value)}>
          <option value="">Select a user</option>
          {users.map((person) => <option key={person.id} value={person.id}>{person.firstName} {person.lastName} · {person.email}</option>)}
        </select>
        {sessions.map((session) => <div key={session.id} style={{ borderBottom: "1px solid var(--border-default)", padding: ".5rem 0" }}><strong>{session.deviceInfo || "Unknown device"}</strong><p>{session.status} · {session.authMethod} · {session.ipAddress || "IP unavailable"} · {new Date(session.lastSeenAt).toLocaleString()}</p></div>)}
        <button className="security-danger-button" type="button" disabled={busy || sessionsLoading || !target || !validReason || !sessions.some((session) => session.status === "ACTIVE")} onClick={() => void run(() => apiClient.post(`/enterprise-identity/users/${encodeURIComponent(target)}/revoke-sessions`, { reason }), "Selected user’s active sessions revoked.")}>Revoke this user’s active sessions</button>
      </section>
    </>
  );
}
