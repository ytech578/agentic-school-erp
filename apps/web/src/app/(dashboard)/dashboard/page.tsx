"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { useAIStore } from "@/store/ai.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Users, GraduationCap, DollarSign, Activity, BookOpen, Sparkles, CheckCircle, Clock } from "lucide-react";
import { apiClient } from "@/lib/axios";

// ─── ADMIN / PRINCIPAL DASHBOARD ──────────────────────────────────────────
function AdminDashboard({ user }: { user: any }) {
  const router = useRouter();
  const { toggle: toggleAI } = useAIStore();
  const [stats, setStats] = useState<any[]>([]);
  const [recentEnrollments, setRecentEnrollments] = useState<any[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInsightsLoading, setIsInsightsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const statsRes = await apiClient.get("/dashboard/stats");
        const data = statsRes.data.data || statsRes.data;
        const iconMap: Record<string, any> = { GraduationCap, Users, BookOpen, Activity, DollarSign };
        setStats((data.stats || []).map((stat: any) => ({ ...stat, icon: iconMap[stat.icon] || Activity })));
        setRecentEnrollments(data.recentEnrollments || []);
      } catch (error) {
        // Ignore API errors (like 401s)
      } finally {
        setIsLoading(false);
      }
    };

    const fetchInsights = async () => {
      try {
        const insightsRes = await apiClient.get("/ai/insights");
        const insightsData = insightsRes.data.data || insightsRes.data;
        setInsights(insightsData.insights || [
          "Fee collection is tracking well this month.",
          "Attendance tracking is active for all classes.",
          "Enter exam marks to generate report cards."
        ]);
      } catch (error) {
        setInsights([
          "Fee collection is tracking well this month.",
          "Attendance tracking is active for all classes.",
          "Enter exam marks to generate report cards."
        ]);
      } finally {
        setIsInsightsLoading(false);
      }
    };

    fetchStats();
    fetchInsights();
  }, []);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.5rem" }}>
        {isLoading ? (
          Array(4).fill(0).map((_, i) => (
            <Card key={i}><CardContent style={{ padding: "2rem", display: "flex", justifyContent: "center" }}><span className="spinner" /></CardContent></Card>
          ))
        ) : (
          stats.map((stat, i) => (
            <Card key={i} className={`animate-fade-in delay-${(i % 5) * 100}`}>
              <CardHeader style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <CardTitle style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontWeight: 500 }}>{stat.title}</CardTitle>
                <stat.icon size={18} color={stat.color} />
              </CardHeader>
              <CardContent>
                <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "var(--text-primary)" }}>{stat.value}</div>
                <p style={{ fontSize: "0.75rem", color: "var(--success)", marginTop: "0.25rem", display: "flex", alignItems: "center", gap: "0.25rem", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600 }}>+4.2%</span> from last month
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="animate-fade-in delay-200" style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.5rem" }}>
        {/* AI Insights Card */}
        <div style={{ background: "var(--brand-gradient)", borderRadius: "var(--radius-xl)", padding: "1px", boxShadow: "var(--shadow-glow)" }}>
          <div style={{ background: "var(--bg-surface)", borderRadius: "calc(var(--radius-xl) - 1px)", padding: "1.5rem", height: "100%", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "var(--brand-primary)" }}>
                <Sparkles size={20} />
                <h3 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)" }}>AI Insights</h3>
              </div>
              <Button size="sm" variant="outline" onClick={toggleAI}>Ask AI Assistant</Button>
            </div>
            {isInsightsLoading ? (
              <div style={{ display: "flex", gap: "1rem", flexDirection: "column", padding: "1rem" }}>
                <div style={{ height: "1rem", background: "var(--bg-elevated)", borderRadius: "4px", width: "80%", animation: "shimmer 1.5s infinite" }} />
                <div style={{ height: "1rem", background: "var(--bg-elevated)", borderRadius: "4px", width: "90%", animation: "shimmer 1.5s infinite" }} />
              </div>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {insights.map((insight, idx) => (
                  <li key={idx} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--brand-primary)", marginTop: "0.5rem", flexShrink: 0 }} />
                    {insight}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem" }}>
        <Card className="animate-fade-in delay-300">
          <CardHeader><CardTitle>Recent Enrollments</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>Loading...</p>
            ) : recentEnrollments.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {recentEnrollments.map((student: any) => (
                  <div key={student.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.5rem" }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: "var(--text-sm)" }}>{student.firstName} {student.lastName}</div>
                      <div style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)" }}>{student.email}</div>
                    </div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>{new Date(student.createdAt).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>No recent enrollments found.</p>
            )}
          </CardContent>
        </Card>
        
        <Card className="animate-fade-in delay-400">
          <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
          <CardContent style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <Button variant="secondary" onClick={() => router.push('/students/new')} style={{ justifyContent: "flex-start" }}>Admit Student</Button>
            <Button variant="secondary" onClick={() => router.push('/fees')} style={{ justifyContent: "flex-start" }}>Collect Fee</Button>
            <Button variant="secondary" onClick={() => router.push('/staff/new')} style={{ justifyContent: "flex-start" }}>Onboard Staff</Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// ─── TEACHER DASHBOARD ────────────────────────────────────────────────────
function TeacherDashboard({ user }: { user: any }) {
  const router = useRouter();
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeacherStats = async () => {
      try {
        const res = await apiClient.get("/dashboard/teacher");
        const data = res.data.data || res.data;
        setClasses(data.classes || []);
      } catch (error) {
        console.error("Failed to fetch teacher dashboard stats", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTeacherStats();
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-semibold)" }}>My Classes Today</h2>
      {loading ? (
        <div style={{ display: "flex", gap: "1rem" }}><div style={{ height: "120px", flex: 1, background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", animation: "shimmer 1.5s infinite" }} /></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>
          {classes.map((c: any) => (
            <div key={c.id} style={{ background: "var(--bg-surface)", padding: "1.5rem", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-card)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <div>
                  <h3 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)" }}>{c.className} — {c.section}</h3>
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{c.subject} · {c.studentsCount} students</span>
                </div>
                {c.attendanceMarked ? <CheckCircle size={20} color="var(--status-success)" /> : <Clock size={20} color="var(--status-warning)" />}
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <Button size="sm" variant={c.attendanceMarked ? "outline" : "primary"} style={{ flex: 1 }} onClick={() => router.push('/attendance')}>
                  {c.attendanceMarked ? "View Attendance" : "Mark Attendance"}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => router.push('/exams')}>Enter Marks</Button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.5rem" }}>
        <Card>
          <CardHeader><CardTitle>Schedule</CardTitle></CardHeader>
          <CardContent>
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", border: "1px dashed var(--border-default)" }}>
              Timetable and schedule management coming in Phase 2
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── PARENT DASHBOARD ─────────────────────────────────────────────────────
function ParentDashboard({ user }: { user: any }) {
  const router = useRouter();
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchParentStats = async () => {
      try {
        const res = await apiClient.get("/dashboard/parent");
        const data = res.data.data || res.data;
        setChildren(data.children || []);
      } catch (error) {
        console.error("Failed to fetch parent dashboard stats", error);
      } finally {
        setLoading(false);
      }
    };
    fetchParentStats();
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {loading ? (
        <div style={{ height: "200px", background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", animation: "shimmer 1.5s infinite" }} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {children.map(child => (
            <div key={child.id} style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-surface)", padding: "1.5rem", borderRadius: "var(--radius-lg)", border: "1px solid var(--brand-primary-light)", borderLeft: "4px solid var(--brand-primary)", boxShadow: "var(--shadow-card)" }}>
                <div>
                  <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-bold)" }}>{child.name}</h2>
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{child.className}</span>
                </div>
                <Button variant="outline" size="sm">View Profile</Button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
                <Card>
                  <CardHeader><CardTitle>Attendance</CardTitle></CardHeader>
                  <CardContent>
                    <div style={{ fontSize: "var(--text-3xl)", fontWeight: "var(--font-bold)", color: child.attendancePct >= 75 ? "var(--status-success)" : "var(--status-danger)" }}>
                      {child.attendancePct}%
                    </div>
                    <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: "0.25rem" }}>Current month</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Fee Status</CardTitle></CardHeader>
                  <CardContent>
                    <div style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)", color: "var(--text-primary)", marginBottom: "0.25rem" }}>
                      ₹{child.feeAmount}
                    </div>
                    <p style={{ fontSize: "var(--text-sm)", color: "var(--status-warning)", marginBottom: "1rem", fontWeight: "var(--font-medium)" }}>
                      Due by {new Date(child.nextFeeDue).toLocaleDateString()}
                    </p>
                    <Button style={{ width: "100%" }}>Pay Now (Phase 2)</Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── STUDENT DASHBOARD ────────────────────────────────────────────────────
function StudentDashboard({ user }: { user: any }) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudentStats = async () => {
      try {
        const res = await apiClient.get("/dashboard/student");
        const json = res.data.data || res.data;
        setData(json);
      } catch (error) {
        console.error("Failed to fetch student dashboard stats", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStudentStats();
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {loading || !data ? (
        <div style={{ height: "200px", background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", animation: "shimmer 1.5s infinite" }} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-surface)", padding: "1.5rem", borderRadius: "var(--radius-lg)", border: "1px solid var(--brand-primary-light)", borderLeft: "4px solid var(--brand-primary)", boxShadow: "var(--shadow-card)" }}>
            <div>
              <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-bold)" }}>{user.firstName} {user.lastName}</h2>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{data.studentInfo?.className} • Roll No: {data.studentInfo?.rollNumber}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push('/settings')}>My Profile</Button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
            <Card>
              <CardHeader><CardTitle>My Attendance</CardTitle></CardHeader>
              <CardContent>
                <div style={{ fontSize: "var(--text-3xl)", fontWeight: "var(--font-bold)", color: data.attendancePct >= 75 ? "var(--status-success)" : "var(--status-danger)" }}>
                  {data.attendancePct}%
                </div>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: "0.25rem" }}>Current academic year</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Fee Status</CardTitle></CardHeader>
              <CardContent>
                <div style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)", color: "var(--text-primary)", marginBottom: "0.25rem" }}>
                  ₹{data.pendingFees}
                </div>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--status-warning)", marginBottom: "1rem", fontWeight: "var(--font-medium)" }}>
                  Outstanding Dues
                </p>
              </CardContent>
            </Card>
            
            <Card style={{ gridColumn: "1 / -1" }}>
              <CardHeader><CardTitle>Recent Marks</CardTitle></CardHeader>
              <CardContent>
                {data.recentMarks?.length > 0 ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                    {data.recentMarks.map((mark: any, idx: number) => (
                      <div key={idx} style={{ padding: "1rem", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}>
                        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>{mark.subject}</div>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem" }}>
                          <span style={{ fontSize: "var(--text-2xl)", fontWeight: "bold" }}>{mark.score}</span>
                          <span style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)", paddingBottom: "0.25rem" }}>/ {mark.maxScore}</span>
                          <span style={{ marginLeft: "auto", background: "var(--brand-primary-light)", color: "var(--brand-primary)", padding: "0.125rem 0.5rem", borderRadius: "100px", fontSize: "0.75rem", fontWeight: "bold" }}>{mark.grade}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)" }}>
                    No recent marks available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN DASHBOARD ROUTER ────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuthStore();

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ marginBottom: "0.5rem" }}>Dashboard</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
            Welcome back, {user?.firstName || 'User'}! 
            {user?.role === 'TEACHER' ? " Here are your classes today." : 
             user?.role === 'PARENT' ? " Here's an overview of your child's progress." : 
             user?.role === 'STUDENT' ? " Here's your academic summary." : 
             " Here's what's happening today."}
          </p>
        </div>
      </div>

      {user?.role === 'TEACHER' ? <TeacherDashboard user={user} /> :
       user?.role === 'PARENT' ? <ParentDashboard user={user} /> :
       user?.role === 'STUDENT' ? <StudentDashboard user={user} /> :
       ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL'].includes(user?.role || '') ? <AdminDashboard user={user} /> :
       (
         <div style={{ textAlign: "center", padding: "4rem", background: "var(--bg-surface)", borderRadius: "var(--radius-lg)" }}>
           <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Welcome to AI School ERP</h2>
           <p style={{ color: "var(--text-secondary)", marginTop: "0.5rem" }}>Your role dashboard is being prepared.</p>
         </div>
       )}
    </div>
  );
}
