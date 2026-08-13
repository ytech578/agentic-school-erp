"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import { Plus, CheckCircle } from "lucide-react";

type Tab = "dashboard" | "enquiries" | "applications";

export default function AdmissionsPage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [analytics, setAnalytics] = useState<any>(null);
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Forms
  const [showEnquiryForm, setShowEnquiryForm] = useState(false);
  const [showAppForm, setShowAppForm] = useState(false);
  
  // Basic states for forms (in a real app, use react-hook-form)
  const [enquiryForm, setEnquiryForm] = useState({ studentName: "", classApplied: "", parentName: "", phone: "", source: "WALK_IN" });
  const [appForm, setAppForm] = useState({ studentName: "", dateOfBirth: "", gender: "MALE", classApplied: "", parentName: "", parentPhone: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (tab === "dashboard") fetchAnalytics();
    else if (tab === "enquiries") fetchEnquiries();
    else if (tab === "applications") fetchApplications();
  }, [tab]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get("/admissions/analytics");
      setAnalytics(res.data.data || res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEnquiries = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get("/admissions/enquiries");
      setEnquiries(res.data.data || res.data || []);
    } catch (e) {} finally { setIsLoading(false); }
  };

  const fetchApplications = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get("/admissions/applications");
      setApplications(res.data.data || res.data || []);
    } catch (e) {} finally { setIsLoading(false); }
  };

  const submitEnquiry = async () => {
    setIsSubmitting(true);
    try {
      await apiClient.post("/admissions/enquiries", enquiryForm);
      setShowEnquiryForm(false);
      setEnquiryForm({ studentName: "", classApplied: "", parentName: "", phone: "", source: "WALK_IN" });
      fetchEnquiries();
    } catch (e) {} finally { setIsSubmitting(false); }
  };

  const submitApplication = async () => {
    setIsSubmitting(true);
    try {
      await apiClient.post("/admissions/applications", appForm);
      setShowAppForm(false);
      setAppForm({ studentName: "", dateOfBirth: "", gender: "MALE", classApplied: "", parentName: "", parentPhone: "" });
      fetchApplications();
    } catch (e) {} finally { setIsSubmitting(false); }
  };

  const updateAppStatus = async (id: string, status: string) => {
    try {
      await apiClient.patch(`/admissions/applications/${id}/status`, { status });
      fetchApplications();
    } catch (e) {}
  };

  const convertToStudent = async (id: string) => {
    try {
      await apiClient.post(`/admissions/applications/${id}/convert`);
      fetchApplications();
      alert("Successfully converted to student!");
    } catch (e: any) {
      alert(e.response?.data?.message || "Error converting");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)", color: "var(--text-primary)", marginBottom: "0.25rem" }}>Admissions CRM</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>Manage enquiries, applications, and student enrollment.</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Button onClick={() => setTab("enquiries")} variant="secondary">View Enquiries</Button>
          <Button onClick={() => setShowAppForm(true)}>
            <Plus size={16} style={{ marginRight: "0.5rem" }} /> New Application
          </Button>
        </div>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid var(--border-default)", gap: "1rem" }}>
        {["dashboard", "enquiries", "applications"].map((t) => (
          <button key={t} onClick={() => setTab(t as Tab)}
            style={{
              padding: "0.75rem 1rem", background: "none", border: "none", cursor: "pointer",
              fontSize: "var(--text-sm)", fontWeight: tab === t ? "var(--font-semibold)" : "var(--font-medium)",
              color: tab === t ? "var(--brand-primary)" : "var(--text-secondary)",
              borderBottom: tab === t ? "2px solid var(--brand-primary)" : "2px solid transparent",
              transition: "all var(--duration-fast)", textTransform: "capitalize"
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* DASHBOARD TAB */}
      {tab === "dashboard" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {isLoading ? (
            <div>Loading analytics...</div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
                <div style={{ background: "var(--bg-surface)", padding: "1.5rem", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)" }}>
                  <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", marginBottom: "0.5rem" }}>Total Applications</p>
                  <h2 style={{ fontSize: "var(--text-3xl)", fontWeight: "var(--font-bold)" }}>
                    {analytics?.applications?.reduce((acc: number, curr: any) => acc + curr._count, 0) || 0}
                  </h2>
                </div>
                <div style={{ background: "var(--bg-surface)", padding: "1.5rem", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)" }}>
                  <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", marginBottom: "0.5rem" }}>Accepted</p>
                  <h2 style={{ fontSize: "var(--text-3xl)", fontWeight: "var(--font-bold)", color: "var(--status-success)" }}>
                    {analytics?.applications?.find((a: any) => a.status === 'ACCEPTED')?._count || 0}
                  </h2>
                </div>
                <div style={{ background: "var(--bg-surface)", padding: "1.5rem", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)" }}>
                  <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", marginBottom: "0.5rem" }}>Total Enquiries</p>
                  <h2 style={{ fontSize: "var(--text-3xl)", fontWeight: "var(--font-bold)", color: "var(--brand-primary)" }}>
                    {analytics?.enquiries?.reduce((acc: number, curr: any) => acc + curr._count, 0) || 0}
                  </h2>
                </div>
              </div>

              <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)", padding: "1.5rem" }}>
                <h3 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)", marginBottom: "1rem" }}>Recent Applications</h3>
                {analytics?.recentApplications?.length > 0 ? (
                   <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border-default)", textAlign: "left", color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
                        <th style={{ padding: "0.75rem 0" }}>App No.</th>
                        <th style={{ padding: "0.75rem 0" }}>Student</th>
                        <th style={{ padding: "0.75rem 0" }}>Class</th>
                        <th style={{ padding: "0.75rem 0" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.recentApplications.map((app: any) => (
                        <tr key={app.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <td style={{ padding: "1rem 0", fontWeight: "var(--font-medium)" }}>{app.applicationNo}</td>
                          <td style={{ padding: "1rem 0" }}>{app.studentName}</td>
                          <td style={{ padding: "1rem 0" }}>{app.classApplied}</td>
                          <td style={{ padding: "1rem 0" }}>
                            <span style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-semibold)", padding: "0.25rem 0.5rem", borderRadius: "var(--radius-full)", background: "var(--bg-elevated)" }}>
                              {app.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                   </table>
                ) : (
                  <p style={{ color: "var(--text-secondary)" }}>No recent applications.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ENQUIRIES TAB */}
      {tab === "enquiries" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={() => setShowEnquiryForm(true)}><Plus size={16} style={{ marginRight: "0.5rem" }}/> Log Enquiry</Button>
          </div>

          {showEnquiryForm && (
            <div style={{ background: "var(--bg-surface)", padding: "1.5rem", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)" }}>
              <h3 style={{ marginBottom: "1rem" }}>Log New Enquiry</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <input placeholder="Student Name" value={enquiryForm.studentName} onChange={e => setEnquiryForm(f => ({...f, studentName: e.target.value}))} style={{ padding: "0.625rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }} />
                <input placeholder="Class Applied (e.g. Class 1)" value={enquiryForm.classApplied} onChange={e => setEnquiryForm(f => ({...f, classApplied: e.target.value}))} style={{ padding: "0.625rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }} />
                <input placeholder="Parent Name" value={enquiryForm.parentName} onChange={e => setEnquiryForm(f => ({...f, parentName: e.target.value}))} style={{ padding: "0.625rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }} />
                <input placeholder="Phone Number" value={enquiryForm.phone} onChange={e => setEnquiryForm(f => ({...f, phone: e.target.value}))} style={{ padding: "0.625rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }} />
              </div>
              <div style={{ display: "flex", gap: "1rem" }}>
                <Button onClick={submitEnquiry} isLoading={isSubmitting}>Save</Button>
                <Button variant="ghost" onClick={() => setShowEnquiryForm(false)}>Cancel</Button>
              </div>
            </div>
          )}

          <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)", overflow: "hidden" }}>
             <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-default)", background: "var(--bg-elevated)", textAlign: "left", fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                  <th style={{ padding: "1rem" }}>Date</th>
                  <th style={{ padding: "1rem" }}>Student</th>
                  <th style={{ padding: "1rem" }}>Parent</th>
                  <th style={{ padding: "1rem" }}>Class</th>
                  <th style={{ padding: "1rem" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {enquiries.length === 0 ? <tr><td colSpan={5} style={{ padding: "2rem", textAlign: "center" }}>No enquiries found.</td></tr> :
                 enquiries.map((e) => (
                  <tr key={e.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "1rem" }}>{new Date(e.createdAt).toLocaleDateString()}</td>
                    <td style={{ padding: "1rem", fontWeight: "var(--font-medium)" }}>{e.studentName}</td>
                    <td style={{ padding: "1rem" }}>{e.parentName}<br/><span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>{e.phone}</span></td>
                    <td style={{ padding: "1rem" }}>{e.classApplied}</td>
                    <td style={{ padding: "1rem" }}>
                      <span style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-semibold)", padding: "0.25rem 0.5rem", borderRadius: "var(--radius-full)", background: e.status === 'CONVERTED' ? 'var(--status-success-bg)' : 'var(--bg-elevated)', color: e.status === 'CONVERTED' ? 'var(--status-success)' : 'inherit' }}>
                        {e.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
             </table>
          </div>
        </div>
      )}

      {/* APPLICATIONS TAB (Kanban) */}
      {tab === "applications" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", height: "100%" }}>
          {showAppForm && (
            <div style={{ background: "var(--bg-surface)", padding: "1.5rem", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)" }}>
              <h3 style={{ marginBottom: "1rem" }}>New Application</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <input placeholder="Student Full Name" value={appForm.studentName} onChange={e => setAppForm(f => ({...f, studentName: e.target.value}))} style={{ padding: "0.625rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }} />
                <input type="date" value={appForm.dateOfBirth} onChange={e => setAppForm(f => ({...f, dateOfBirth: e.target.value}))} style={{ padding: "0.625rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }} />
                <input placeholder="Class Applied (e.g. Class 1)" value={appForm.classApplied} onChange={e => setAppForm(f => ({...f, classApplied: e.target.value}))} style={{ padding: "0.625rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }} />
                <select value={appForm.gender} onChange={e => setAppForm(f => ({...f, gender: e.target.value}))} style={{ padding: "0.625rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}>
                  <option value="MALE">Male</option><option value="FEMALE">Female</option>
                </select>
                <input placeholder="Parent Name" value={appForm.parentName} onChange={e => setAppForm(f => ({...f, parentName: e.target.value}))} style={{ padding: "0.625rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }} />
                <input placeholder="Parent Phone" value={appForm.parentPhone} onChange={e => setAppForm(f => ({...f, parentPhone: e.target.value}))} style={{ padding: "0.625rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }} />
              </div>
              <div style={{ display: "flex", gap: "1rem" }}>
                <Button onClick={submitApplication} isLoading={isSubmitting}>Submit Application</Button>
                <Button variant="ghost" onClick={() => setShowAppForm(false)}>Cancel</Button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "1rem", overflowX: "auto", paddingBottom: "1rem" }}>
            {["SUBMITTED", "SHORTLISTED", "INTERVIEW_SCHEDULED", "ACCEPTED"].map(statusGroup => {
              const columnApps = applications.filter(a => a.status === statusGroup);
              return (
                <div key={statusGroup} style={{ flex: "0 0 300px", display: "flex", flexDirection: "column", gap: "0.75rem", background: "var(--bg-elevated)", padding: "1rem", borderRadius: "var(--radius-lg)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h4 style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-semibold)", color: "var(--text-secondary)" }}>{statusGroup.replace("_", " ")}</h4>
                    <span style={{ fontSize: "var(--text-xs)", background: "var(--bg-surface)", padding: "0.125rem 0.5rem", borderRadius: "var(--radius-full)" }}>{columnApps.length}</span>
                  </div>
                  
                  {columnApps.map(app => (
                    <div key={app.id} style={{ background: "var(--bg-surface)", padding: "1rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--brand-primary)", fontWeight: "var(--font-medium)" }}>{app.applicationNo}</span>
                        {app.convertedStudentId && <CheckCircle size={14} color="var(--status-success)" />}
                      </div>
                      <h5 style={{ fontSize: "var(--text-base)", fontWeight: "var(--font-semibold)" }}>{app.studentName}</h5>
                      <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>Class: {app.classApplied} • {new Date(app.createdAt).toLocaleDateString()}</p>
                      
                      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                        {statusGroup === "SUBMITTED" && <Button size="sm" variant="secondary" onClick={() => updateAppStatus(app.id, "SHORTLISTED")} style={{ flex: 1, fontSize: "0.7rem", padding: "0.25rem" }}>Shortlist</Button>}
                        {statusGroup === "SHORTLISTED" && <Button size="sm" variant="secondary" onClick={() => updateAppStatus(app.id, "INTERVIEW_SCHEDULED")} style={{ flex: 1, fontSize: "0.7rem", padding: "0.25rem" }}>Interview</Button>}
                        {statusGroup === "INTERVIEW_SCHEDULED" && <Button size="sm" variant="secondary" onClick={() => updateAppStatus(app.id, "ACCEPTED")} style={{ flex: 1, fontSize: "0.7rem", padding: "0.25rem" }}>Accept</Button>}
                        {statusGroup === "ACCEPTED" && !app.convertedStudentId && <Button size="sm" onClick={() => convertToStudent(app.id)} style={{ flex: 1, fontSize: "0.7rem", padding: "0.25rem" }}>Enroll as Student</Button>}
                        {app.convertedStudentId && <span style={{ fontSize: "var(--text-xs)", color: "var(--status-success)", fontWeight: "var(--font-medium)", textAlign: "center", width: "100%" }}>Enrolled</span>}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
