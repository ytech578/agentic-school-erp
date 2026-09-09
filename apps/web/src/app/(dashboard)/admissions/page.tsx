"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import { Plus, CheckCircle, Sparkles, Loader2, X } from "lucide-react";


type Tab = "dashboard" | "enquiries" | "applications";

export default function AdmissionsPage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [analytics, setAnalytics] = useState<any>(null);
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const inputStyle = { padding: "0.625rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" };

  // Forms
  const [showEnquiryForm, setShowEnquiryForm] = useState(false);
  const [showAppForm, setShowAppForm] = useState(false);
  
  // Basic states for forms (in a real app, use react-hook-form)
  const [enquiryForm, setEnquiryForm] = useState({ studentName: "", classApplied: "", parentName: "", phone: "", source: "WALK_IN" });
  const [appForm, setAppForm] = useState({ studentName: "", dateOfBirth: "", gender: "MALE", classApplied: "", parentName: "", parentPhone: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workflowState, setWorkflowState] = useState<{ appId: string; loading: boolean } | null>(null);
  const [workflowResult, setWorkflowResult] = useState<{ appId: string; appName: string; results: any[] } | null>(null);


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

  const runAgenticWorkflow = async (appId: string, appName: string) => {
    setWorkflowState({ appId, loading: true });
    try {
      const res = await apiClient.post(`/ai/admissions/${appId}/workflow`);
      const data = res.data.data || res.data;
      setWorkflowResult({ appId, appName, results: data.agentResults || [] });
    } catch (e) {
      console.error("Workflow failed:", e);
    } finally {
      setWorkflowState(null);
    }
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

  const updateEnquiryStatus = async (id: string, status: string) => {
    try {
      await apiClient.patch(`/admissions/enquiries/${id}/status`, { status });
      fetchEnquiries();
    } catch (e) {}
  };

  const calculateLeadScores = async () => {
    setIsSubmitting(true);
    try {
      await apiClient.post("/admissions/enquiries/calculate-scores");
      fetchEnquiries();
    } catch (e) {} finally { setIsSubmitting(false); }
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
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Button onClick={calculateLeadScores} variant="secondary" isLoading={isSubmitting}>
              Run AI Lead Scoring
            </Button>
            <Button onClick={() => setShowEnquiryForm(true)}><Plus size={16} style={{ marginRight: "0.5rem" }}/> Log Enquiry</Button>
          </div>

          {showEnquiryForm && (
            <div style={{ background: "var(--bg-surface)", padding: "1.5rem", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)" }}>
              <h3 style={{ marginBottom: "1rem" }}>Log New Enquiry</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <input placeholder="Student Name" value={enquiryForm.studentName} onChange={e => setEnquiryForm(f => ({...f, studentName: e.target.value}))} style={inputStyle} />
                <input placeholder="Class Applied (e.g. Class 1)" value={enquiryForm.classApplied} onChange={e => setEnquiryForm(f => ({...f, classApplied: e.target.value}))} style={inputStyle} />
                <input placeholder="Parent Name" value={enquiryForm.parentName} onChange={e => setEnquiryForm(f => ({...f, parentName: e.target.value}))} style={inputStyle} />
                <input placeholder="Phone Number" value={enquiryForm.phone} onChange={e => setEnquiryForm(f => ({...f, phone: e.target.value}))} style={inputStyle} />
              </div>
              <div style={{ display: "flex", gap: "1rem" }}>
                <Button onClick={submitEnquiry} isLoading={isSubmitting}>Save</Button>
                <Button variant="ghost" onClick={() => setShowEnquiryForm(false)}>Cancel</Button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "1rem", overflowX: "auto", paddingBottom: "1rem" }}>
            {["NEW", "CONTACTED", "INTERESTED", "NOT_INTERESTED", "CONVERTED"].map(statusGroup => {
              const columnEnqs = enquiries.filter(e => e.status === statusGroup);
              return (
                <div key={statusGroup} style={{ flex: "0 0 320px", display: "flex", flexDirection: "column", gap: "0.75rem", background: "var(--bg-elevated)", padding: "1rem", borderRadius: "var(--radius-lg)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h4 style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-semibold)", color: "var(--text-secondary)" }}>{statusGroup.replace("_", " ")}</h4>
                    <span style={{ fontSize: "var(--text-xs)", background: "var(--bg-surface)", padding: "0.125rem 0.5rem", borderRadius: "var(--radius-full)" }}>{columnEnqs.length}</span>
                  </div>
                  
                  {columnEnqs.map(e => (
                    <div key={e.id} style={{ background: "var(--bg-surface)", padding: "1rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <h5 style={{ fontSize: "var(--text-base)", fontWeight: "var(--font-semibold)" }}>{e.studentName}</h5>
                          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>Class: {e.classApplied}</span>
                        </div>
                        {e.leadScore !== null && (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", padding: "0.25rem 0.5rem", borderRadius: "var(--radius-full)", background: e.leadScore >= 80 ? "rgba(16, 185, 129, 0.1)" : e.leadScore >= 50 ? "rgba(245, 158, 11, 0.1)" : "rgba(239, 68, 68, 0.1)", color: e.leadScore >= 80 ? "var(--status-success)" : e.leadScore >= 50 ? "var(--status-warning)" : "var(--status-danger)", fontWeight: "var(--font-bold)", fontSize: "var(--text-xs)" }}>
                            🔥 {e.leadScore}
                          </div>
                        )}
                      </div>
                      
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                        <p>{e.parentName} • {e.phone}</p>
                      </div>

                      {e.nextAction && (
                        <div style={{ marginTop: "0.5rem", padding: "0.5rem", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", borderLeft: "2px solid var(--brand-teal)", fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                           <span style={{ fontWeight: "var(--font-medium)", color: "var(--text-primary)" }}>Next Action:</span> {e.nextAction}
                        </div>
                      )}
                      
                      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                        {statusGroup === "NEW" && <Button size="sm" variant="secondary" onClick={() => updateEnquiryStatus(e.id, "CONTACTED")} style={{ flex: 1, fontSize: "0.7rem", padding: "0.25rem" }}>Contacted</Button>}
                        {statusGroup === "CONTACTED" && <Button size="sm" variant="secondary" onClick={() => updateEnquiryStatus(e.id, "INTERESTED")} style={{ flex: 1, fontSize: "0.7rem", padding: "0.25rem" }}>Interested</Button>}
                        {statusGroup === "INTERESTED" && <Button size="sm" variant="primary" onClick={() => updateEnquiryStatus(e.id, "CONVERTED")} style={{ flex: 1, fontSize: "0.7rem", padding: "0.25rem", background: "var(--status-success)", borderColor: "var(--status-success)" }}>Convert</Button>}
                        {(statusGroup === "NEW" || statusGroup === "CONTACTED") && <Button size="sm" variant="ghost" onClick={() => updateEnquiryStatus(e.id, "NOT_INTERESTED")} style={{ flex: 1, fontSize: "0.7rem", padding: "0.25rem" }}>Close</Button>}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
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
                <input placeholder="Student Full Name" value={appForm.studentName} onChange={e => setAppForm(f => ({...f, studentName: e.target.value}))} style={inputStyle} />
                <input type="date" value={appForm.dateOfBirth} onChange={e => setAppForm(f => ({...f, dateOfBirth: e.target.value}))} style={inputStyle} />
                <input placeholder="Class Applied (e.g. Class 1)" value={appForm.classApplied} onChange={e => setAppForm(f => ({...f, classApplied: e.target.value}))} style={inputStyle} />
                <select value={appForm.gender} onChange={e => setAppForm(f => ({...f, gender: e.target.value}))} style={inputStyle}>
                  <option value="MALE">Male</option><option value="FEMALE">Female</option>
                </select>
                <input placeholder="Parent Name" value={appForm.parentName} onChange={e => setAppForm(f => ({...f, parentName: e.target.value}))} style={inputStyle} />
                <input placeholder="Parent Phone" value={appForm.parentPhone} onChange={e => setAppForm(f => ({...f, parentPhone: e.target.value}))} style={inputStyle} />
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
                      
                      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                        {statusGroup === "SUBMITTED" && <Button size="sm" variant="secondary" onClick={() => updateAppStatus(app.id, "SHORTLISTED")} style={{ flex: 1, fontSize: "0.7rem", padding: "0.25rem" }}>Shortlist</Button>}
                        {statusGroup === "SHORTLISTED" && <Button size="sm" variant="secondary" onClick={() => updateAppStatus(app.id, "INTERVIEW_SCHEDULED")} style={{ flex: 1, fontSize: "0.7rem", padding: "0.25rem" }}>Interview</Button>}
                        {statusGroup === "INTERVIEW_SCHEDULED" && <Button size="sm" variant="secondary" onClick={() => updateAppStatus(app.id, "ACCEPTED")} style={{ flex: 1, fontSize: "0.7rem", padding: "0.25rem" }}>Accept</Button>}
                        {statusGroup === "ACCEPTED" && !app.convertedStudentId && <Button size="sm" onClick={() => convertToStudent(app.id)} style={{ flex: 1, fontSize: "0.7rem", padding: "0.25rem" }}>Enroll as Student</Button>}
                        {app.convertedStudentId && <span style={{ fontSize: "var(--text-xs)", color: "var(--status-success)", fontWeight: "var(--font-medium)", textAlign: "center", width: "100%" }}>Enrolled</span>}
                        <button
                          onClick={() => runAgenticWorkflow(app.id, app.studentName)}
                          disabled={!!workflowState && workflowState.appId === app.id && workflowState.loading}
                          title="Run AI Multi-Agent Workflow"
                          style={{
                            display: "flex", alignItems: "center", gap: "0.25rem",
                            padding: "0.25rem 0.5rem", borderRadius: "var(--radius-md)",
                            background: "linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(139,92,246,0.1) 100%)",
                            border: "1px solid rgba(99,102,241,0.3)", color: "var(--brand-primary)",
                            fontSize: "0.65rem", cursor: "pointer", fontWeight: 600,
                            width: "100%", justifyContent: "center", marginTop: "0.25rem"
                          }}>
                          {!!workflowState && workflowState.appId === app.id && workflowState.loading
                            ? <><Loader2 size={10} className="animate-spin" /> Analyzing...</>
                            : <><Sparkles size={10} /> AI Workflow</>
                          }
                        </button>
                      </div>

                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Workflow Result Modal */}
      {workflowResult && (
        <div style={{
          position: "fixed", inset: 0, background: "var(--bg-overlay)",
          backdropFilter: "var(--modal-backdrop-blur)", WebkitBackdropFilter: "var(--modal-backdrop-blur)",
          zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", animation: "fadeIn 0.2s ease-out"
        }}>
          <div style={{
            background: "var(--bg-surface-solid)", backgroundColor: "var(--bg-surface-solid)", opacity: 1,
            borderRadius: "var(--radius-xl)",
            border: "1px solid var(--border-default)", width: "100%", maxWidth: "600px",
            boxShadow: "var(--modal-shadow)", overflow: "hidden", animation: "zoomIn 0.2s ease-out"
          }}>
            <div style={{
              padding: "1.5rem", borderBottom: "1px solid var(--border-default)",
              background: "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.08) 100%)",
              display: "flex", alignItems: "center", justifyContent: "space-between"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <Sparkles size={24} color="var(--brand-primary)" />
                <div>
                  <h3 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-bold)" }}>AI Admission Workflow</h3>
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>Results for: {workflowResult.appName}</p>
                </div>
              </div>
              <button onClick={() => setWorkflowResult(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem", maxHeight: "60vh", overflowY: "auto" }}>
              {workflowResult.results.map((r: any, idx: number) => (
                <div key={idx} style={{
                  padding: "1.25rem", borderRadius: "var(--radius-lg)",
                  border: `1px solid ${r.status === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.3)'}`,
                  background: r.status === 'error' ? 'rgba(239,68,68,0.05)' : 'rgba(99,102,241,0.05)'
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                    <span style={{
                      fontSize: "var(--text-xs)", fontWeight: "var(--font-bold)",
                      padding: "0.2rem 0.6rem", borderRadius: "var(--radius-full)",
                      background: r.status === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.2)',
                      color: r.status === 'error' ? '#ef4444' : 'var(--brand-primary)'
                    }}>🤖 {r.agent}</span>
                    <span style={{ fontSize: "var(--text-xs)", color: r.status === 'success' ? "var(--status-success)" : "var(--status-danger)" }}>
                      {r.status === 'success' ? '✓ Success' : '✗ Error'}
                    </span>
                  </div>
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{r.output}</p>
                </div>
              ))}
            </div>
            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--border-default)", display: "flex", justifyContent: "flex-end" }}>
              <Button onClick={() => setWorkflowResult(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
