"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/Button";
import {
  ShieldCheck, Calendar as CalendarIcon, CheckCircle, ChevronRight,
  User, Bell, Car, Award, Send, AlertTriangle, BrainCircuit, CreditCard
} from "lucide-react";
import { apiClient } from "@/lib/axios";
import { useParentData } from "@/hooks/useParentData";

import { formatCurrencyINR as fmt, formatTimeAgo as timeAgo, getGreeting as greet } from "@/lib/formatters";

// ─── Skeleton ────────────────────────────────────────────────────────────────
const Skeleton = ({ w = '100%', h = '1rem' }: { w?: string; h?: string }) => (
  <div style={{ width: w, height: h, background: 'linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)', backgroundSize: '200% 100%', borderRadius: '0.375rem', animation: 'shimmer 1.5s infinite' }} />
);

// ─── Main Component ───────────────────────────────────────────────────────────
export function ParentDashboard({ user }: { user: any }) {
  const router = useRouter();
  const { child, loading: parentLoading, refetch } = useParentData();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [extraLoading, setExtraLoading] = useState(true);
  
  const [payModal, setPayModal] = useState<{ child: any; method: string } | null>(null);
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiClient.get('/notifications?limit=5'),
      child?.id ? apiClient.get(`/exams/student/${child.id}/results`).catch(()=>({data:[]})) : Promise.resolve({data:[]})
    ]).then(([notifRes, marksRes]) => {
      setNotifications(notifRes.data?.data || notifRes.data || []);
      setResults(marksRes.data?.data || marksRes.data || []);
    }).catch(console.error).finally(() => setExtraLoading(false));
  }, [child?.id]);

  const loading = parentLoading || extraLoading;

  const handlePay = async () => {
    if (!payModal) return;
    setPaying(true);
    try {
      const res = await apiClient.post('/fees/parent/pay', {
        studentId: payModal.child.id,
        amount: payModal.child.fees?.outstandingFee || 0,
        paymentMode: payModal.method,
      });
      setReceipt(res.data?.data?.receiptNumber || res.data?.receiptNumber || `RCPT-${Date.now()}`);
      refetch(); // Refresh dashboard after payment
    } catch (e) { console.error(e); }
    finally { setPaying(false); }
  };

  const notifIconMap: Record<string, { bg: string; color: string; icon: any }> = {
    ACADEMIC: { bg: 'var(--risk-medium-bg)', color: 'var(--risk-medium)', icon: AlertTriangle },
    FEE: { bg: '#fee2e2', color: 'var(--risk-high)', icon: CreditCard },
    ATTENDANCE: { bg: 'var(--brand-blue-subtle)', color: 'var(--brand-blue)', icon: CalendarIcon },
    TRANSPORT: { bg: 'var(--risk-low-bg)', color: 'var(--risk-low)', icon: Car },
    GENERAL: { bg: 'var(--brand-blue-subtle)', color: 'var(--brand-blue)', icon: Bell },
  };

  const attendancePct = child?.attendance?.overall ?? 94;
  const feeAmount = child?.fees?.outstandingFee || 0;

  // Process marks dynamically
  const allMarks = results.flatMap((exam: any) =>
    (exam.subjects || exam.marks || []).map((s: any) => ({
      exam: exam.name || exam.examName,
      subject: s.subjectName || s.subject,
      score: Number(s.marksObtained ?? s.score ?? 0),
      max: Number(s.maxMarks ?? s.totalMarks ?? 100),
      grade: s.grade,
      date: exam.startDate || exam.date,
    }))
  );
  
  // Calculate top 5 subjects
  const subjectMap: Record<string, { total: number; count: number }> = {};
  for (const m of allMarks) {
    if (!subjectMap[m.subject]) subjectMap[m.subject] = { total: 0, count: 0 };
    subjectMap[m.subject].total += (m.score / m.max) * 100;
    subjectMap[m.subject].count++;
  }
  const displayMarks = Object.entries(subjectMap).map(([s, v]) => ({
    subject: s,
    score: Math.round(v.total / v.count) + '%',
    trend: v.total / v.count > 75 ? '↑' : '↓',
    color: v.total / v.count > 75 ? 'var(--risk-low)' : 'var(--risk-high)',
  })).slice(0, 5);
  
  // Only show marks if real data is available (no static fallback)
  const finalMarks = displayMarks;

  // Process Assignments dynamically
  const assignments = child?.assignments || [];
  const pendingAssignments = assignments.filter((a: any) => a.status !== 'Submitted');
  const completedAssignments = assignments.filter((a: any) => a.status === 'Submitted');

  const displayAssignments = assignments.slice(0, 4);

  // ─── QUICK STATS ───
  const kpis = [
    {
      label: 'Attendance', value: loading ? null : `${attendancePct}%`,
      badge: attendancePct >= 85 ? { text: 'Excellent', color: 'var(--risk-low)', bg: 'var(--risk-low-bg)' } : { text: 'Needs Attention', color: 'var(--risk-medium)', bg: 'var(--risk-medium-bg)' },
      icon: <CalendarIcon size={18} color="var(--risk-low)" />,
    },
    {
      label: 'Academics', value: displayMarks.length ? 'Good' : 'N/A',
      badge: { text: displayMarks.length ? 'On Track' : 'No Data', color: 'var(--risk-low)', bg: 'var(--risk-low-bg)' },
      icon: <CheckCircle size={18} color="var(--risk-low)" />,
    },
    {
      label: 'Assignments', value: `${completedAssignments.length} / ${assignments.length}`,
      badge: pendingAssignments.length > 0 ? { text: `${pendingAssignments.length} Pending`, color: 'var(--risk-medium)', bg: 'var(--risk-medium-bg)' } : { text: 'All Clear', color: 'var(--risk-low)', bg: 'var(--risk-low-bg)' },
      icon: <CheckCircle size={18} color={pendingAssignments.length > 0 ? "var(--risk-medium)" : "var(--risk-low)"} />,
    },
    {
      label: 'Behaviour', value: 'No concerns',
      badge: { text: 'Positive', color: 'var(--risk-low)', bg: 'var(--risk-low-bg)' },
      icon: <User size={18} color="var(--risk-low)" />,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1400px', width: '100%', margin: '0 auto', paddingBottom: '2rem' }}>
      <style>{`@keyframes shimmer { 0%,100%{background-position:200% 0} 50%{background-position:-200% 0} }`}</style>

      {/* ── TOP HERO ── */}
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        {/* Greeting */}
        <div style={{ flex: 2, minWidth: '280px', background: 'var(--risk-low-bg)', borderRadius: '1rem', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', border: '1px solid var(--border-default)' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--brand-teal)', color: "var(--bg-surface)", display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', fontWeight: 800, flexShrink: 0 }}>
            {user?.firstName?.[0] ?? 'P'}
          </div>
          <div>
            {loading ? <Skeleton w="200px" h="1.5rem" /> : (
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{greet()}, {user?.firstName} {user?.lastName} 👋</h1>
            )}
            <div style={{ margin: '0.25rem 0 0.75rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              {loading ? <Skeleton w="180px" /> : `Here's how ${child?.firstName ?? 'your child'} is doing today.`}
            </div>
            {loading ? <Skeleton w="140px" h="1.5rem" /> : (
              <div style={{ display: 'inline-block', background: "var(--bg-surface)", padding: '0.25rem 0.75rem', borderRadius: '2rem', border: '1px solid var(--border-default)', fontSize: '0.813rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {child?.name} • {child?.className}
              </div>
            )}
          </div>
        </div>
        {/* Overall status */}
        <div style={{ flex: 1, minWidth: '240px', background: 'var(--risk-low-bg)', borderRadius: '1rem', padding: '1.5rem', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: "var(--bg-surface)", padding: '0.75rem', borderRadius: '50%', color: 'var(--risk-low)', flexShrink: 0 }}><Award size={28} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, color: 'var(--risk-low)', fontSize: '0.938rem' }}>Overall Status: Doing Well <CheckCircle size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /></span>
              <ChevronRight size={18} color="var(--risk-low)" />
            </div>
            <div style={{ margin: '0.25rem 0 0', fontSize: '0.813rem', color: 'var(--risk-low)', lineHeight: 1.4 }}>
              {loading ? <Skeleton /> : `${child?.firstName ?? 'Your child'} is performing well overall.`}
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ background: "var(--bg-surface)", borderRadius: '1rem', padding: '1.25rem', border: '1px solid var(--border-default)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.813rem', fontWeight: 500 }}>
              {k.icon} {k.label}
            </div>
            {loading ? <Skeleton w="60%" h="2rem" /> : (
              <div style={{ fontSize: k.label === 'Behaviour' ? '1.25rem' : '1.75rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{k.value}</div>
            )}
            <div style={{ display: 'inline-block', marginTop: '0.5rem', background: k.badge.bg, color: k.badge.color, padding: '0.2rem 0.5rem', borderRadius: '2rem', fontSize: '0.7rem', fontWeight: 600 }}>
              {k.badge.text}
            </div>
          </div>
        ))}
      </div>

      {/* ── MIDDLE: Chart + Assignments + Notifications ── */}
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        
        {/* LEFT: Academic Performance (Chart & Marks beside each other) */}
        <div style={{ flex: 1.5, minWidth: '400px', background: "var(--bg-surface)", borderRadius: '1rem', border: '1px solid var(--border-default)', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Academic Performance</h3>
            <span style={{ color: 'var(--risk-low)', fontSize: '0.813rem', fontWeight: 600, cursor: 'pointer' }} onClick={() => router.push('/parent/academics')}>View Details →</span>
          </div>
          <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-default)', marginBottom: '1rem', fontSize: '0.813rem' }}>
            {['Overview', 'Trend'].map((t, i) => (
              <span key={t} style={{ paddingBottom: '0.5rem', borderBottom: i === 0 ? '2px solid var(--risk-low)' : 'none', color: i === 0 ? 'var(--risk-low)' : 'var(--text-secondary)', fontWeight: i === 0 ? 700 : 500, cursor: 'pointer' }}>{t}</span>
            ))}
          </div>
          
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* Mini SVG trend chart */}
            <div style={{ flex: 1, minWidth: '150px', position: 'relative', height: 160 }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-tertiary)', paddingBottom: '16px' }}>
                <span>100%</span><span>80%</span><span>60%</span><span>40%</span>
              </div>
              <svg viewBox="0 0 100 80" preserveAspectRatio="none" style={{ width: '100%', height: '100%', paddingLeft: '24px', boxSizing: 'border-box' }}>
                <line x1="0" y1="0" x2="100" y2="0" stroke="var(--bg-elevated)" strokeWidth="0.5" />
                <line x1="0" y1="26" x2="100" y2="26" stroke="var(--bg-elevated)" strokeWidth="0.5" />
                <line x1="0" y1="53" x2="100" y2="53" stroke="var(--bg-elevated)" strokeWidth="0.5" />
                <line x1="0" y1="80" x2="100" y2="80" stroke="var(--bg-elevated)" strokeWidth="0.5" />
                <polyline points="0,50 33,45 66,40 100,15" fill="none" stroke="var(--risk-low)" strokeWidth="2" strokeLinejoin="round" />
                <polyline points="0,55 33,58 66,62 100,68" fill="none" stroke="var(--brand-blue)" strokeWidth="1.5" strokeDasharray="3,2" strokeLinejoin="round" />
                {[0,33,66,100].map((x,i) => <circle key={x} cx={x} cy={[50,45,40,15][i]} r="2" fill="var(--risk-low)" />)}
              </svg>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.7rem', color: 'var(--text-secondary)', paddingLeft: '24px', marginTop: '4px' }}>
                <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: 'var(--risk-low)', marginRight: 4 }} />{child?.firstName ?? 'Student'}</span>
                <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: 'var(--brand-blue)', marginRight: 4 }} />Class Avg.</span>
              </div>
            </div>
            
            {/* Subjects table */}
            <div style={{ flex: 1.5, minWidth: '200px' }}>
              <table style={{ width: '100%', fontSize: '0.813rem', borderCollapse: 'collapse' }}>
                <thead><tr style={{ color: 'var(--text-secondary)' }}><th style={{ textAlign: 'left', padding: '0.25rem 0', fontWeight: 500 }}>Subject</th><th style={{ fontWeight: 500 }}>Score</th><th style={{ fontWeight: 500 }}>Trend</th></tr></thead>
                <tbody>
                  {loading ? [1,2,3].map(i => <tr key={i}><td><Skeleton h="1.5rem"/></td><td><Skeleton h="1.5rem"/></td><td><Skeleton h="1.5rem"/></td></tr>) : finalMarks.map((m: any) => (
                    <tr key={m.subject} style={{ borderTop: '1px solid var(--bg-surface-hover)' }}>
                      <td style={{ padding: '0.5rem 0', fontWeight: 600, color: 'var(--text-primary)' }}>{m.subject}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{m.score}</td>
                      <td style={{ textAlign: 'center', color: m.color, fontWeight: 700 }}>{m.trend}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* CENTRE: Assignments */}
        <div style={{ flex: 1, minWidth: '240px', background: "var(--bg-surface)", borderRadius: '1rem', border: '1px solid var(--border-default)', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Assignments & Homework</h3>
            <span style={{ color: 'var(--risk-low)', fontSize: '0.813rem', fontWeight: 600, cursor: 'pointer' }} onClick={() => router.push('/parent/assignments')}>View All →</span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', borderBottom: '1px solid var(--border-default)', marginBottom: '1rem', fontSize: '0.75rem' }}>
            {['This Week', `Pending (${pendingAssignments.length})`, `Completed (${completedAssignments.length})`].map((t,i) => (
              <span key={t} style={{ paddingBottom: '0.5rem', borderBottom: i===0 ? '2px solid var(--risk-low)':'none', color: i===0?'var(--risk-low)':'var(--text-secondary)', fontWeight: i===0?700:500 }}>{t}</span>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {loading ? [1,2,3].map(i => <Skeleton key={i} h="2.5rem" />) : displayAssignments.length > 0 ? displayAssignments.map((a: any, i: number, arr: any[]) => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: i < arr.length-1 ? '1rem' : 0, borderBottom: i < arr.length-1 ? '1px solid var(--bg-elevated)' : 'none' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{a.subject}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{a.title}</div>
                </div>
                <span style={{ background: a.statusBg, color: a.statusColor, padding: '0.2rem 0.5rem', borderRadius: '2rem', fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{a.status}</span>
              </div>
            )) : <p style={{ fontSize: '0.813rem', color: 'var(--text-tertiary)', textAlign: 'center', margin: '1rem 0' }}>No recent assignments.</p>}
          </div>
        </div>

        {/* RIGHT: Notifications */}
        <div style={{ flex: 1, minWidth: '260px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Recent Notifications */}
          <div style={{ background: "var(--bg-surface)", borderRadius: '1rem', border: '1px solid var(--border-default)', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Bell size={16} color="var(--text-secondary)" /> Recent Notifications</h3>
              <span style={{ color: 'var(--risk-low)', fontSize: '0.813rem', fontWeight: 600, cursor: 'pointer' }} onClick={() => router.push('/notifications')}>View All →</span>
            </div>
            {loading ? [1,2,3].map(i=><Skeleton key={i} h="3rem" />) : notifications.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {notifications.slice(0,4).map((n, i) => {
                  const kind = notifIconMap[n.type] || notifIconMap.GENERAL;
                  const Icon = kind.icon;
                  return (
                    <div key={n.id} style={{ display: 'flex', gap: '0.75rem', paddingTop: i > 0 ? '1rem' : 0, borderTop: i > 0 ? '1px solid var(--bg-elevated)' : 'none' }}>
                      <div style={{ background: kind.bg, color: kind.color, padding: '0.4rem', borderRadius: '0.5rem', height: 'fit-content', flexShrink: 0 }}><Icon size={16} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.813rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</span>
                          <span style={{ fontSize: '0.688rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', flexShrink: 0 }}>{timeAgo(n.createdAt)}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginTop: '0.1rem', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{n.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: '0.813rem', color: 'var(--text-tertiary)', textAlign: 'center', margin: '1rem 0' }}>No recent notifications.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── BOTTOM ROW ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
        
        {/* Fees & Payments */}
        <div style={{ background: "var(--bg-surface)", borderRadius: '1rem', border: '1px solid var(--border-default)', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><CreditCard size={16} color="var(--risk-low)" /> Fees & Payments</h3>
            <span style={{ color: 'var(--risk-low)', fontSize: '0.813rem', fontWeight: 600, cursor: 'pointer' }} onClick={() => router.push('/parent-fees')}>View All →</span>
          </div>
          {loading ? <Skeleton h="4rem" /> : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Outstanding Amount</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>{fmt(feeAmount)}</div>
                {feeAmount > 0 ? <div style={{ display: 'inline-block', background: 'var(--risk-high-bg)', color: 'var(--risk-high)', padding: '0.15rem 0.5rem', borderRadius: '2rem', fontSize: '0.688rem', fontWeight: 600, marginTop: '0.25rem' }}>Due Soon</div> : null}
              </div>
              <Button size="sm" style={{ background: '#0f766e', color: "var(--bg-surface)", borderRadius: '2rem' }} disabled={!feeAmount} onClick={() => child && setPayModal({ child, method: 'ONLINE_UPI' })}>Pay Now</Button>
            </div>
          )}
        </div>

        {/* Transport */}
        <div style={{ background: "var(--bg-surface)", borderRadius: '1rem', border: '1px solid var(--border-default)', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Car size={16} color="var(--risk-low)" /> Transport</h3>
            <span style={{ background: 'var(--risk-low-bg)', color: 'var(--risk-low)', padding: '0.15rem 0.5rem', borderRadius: '2rem', fontSize: '0.688rem', fontWeight: 600 }}>On Track</span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'center' }}>
            <Car size={28} color="var(--risk-low)" />
            <div><div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Bus 14</div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Driver: Mr. Ramesh</div></div>
          </div>
          <div style={{ fontSize: '0.813rem', fontWeight: 600, color: 'var(--text-primary)' }}>Estimated Arrival: 4:32 PM</div>
          <div style={{ display: 'inline-block', background: 'var(--risk-low-bg)', color: 'var(--risk-low)', padding: '0.2rem 0.5rem', borderRadius: '2rem', fontSize: '0.7rem', fontWeight: 600, marginTop: '0.5rem' }}>Running on schedule</div>
        </div>

        {/* Upcoming Exams */}
        <div style={{ background: "var(--bg-surface)", borderRadius: '1rem', border: '1px solid var(--border-default)', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><CalendarIcon size={16} color="var(--brand-blue)" /> Upcoming Exams</h3>
            <span style={{ color: 'var(--risk-low)', fontSize: '0.813rem', fontWeight: 600, cursor: 'pointer' }}>View All →</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {loading ? [1,2,3].map(i => <Skeleton h="1.5rem" key={i}/>) : (child?.upcomingExams?.length ? child.upcomingExams.map((e: any) => (
              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', borderLeft: `3px solid var(--brand-blue)`, paddingLeft: '0.75rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{e.name}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{new Date(e.startDate).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
              </div>
            )) : <p style={{ fontSize: '0.813rem', color: 'var(--text-tertiary)', textAlign: 'center', margin: '0.5rem 0' }}>No upcoming exams.</p>)}
          </div>
        </div>

        {/* Need Help */}
        <div style={{ background: 'linear-gradient(135deg,var(--brand-blue-subtle),#e0e7ff)', borderRadius: '1rem', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'relative', zIndex: 2 }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 800, color: '#1e3a8a' }}>Need Help?</h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.813rem', color: '#1e40af', maxWidth: '75%', lineHeight: 1.4 }}>Reach out to the school administration for support.</p>
            <Button style={{ background: 'var(--risk-low)', color: "var(--bg-surface)", borderRadius: '2rem', fontSize: '0.813rem' }} onClick={() => router.push('/parent/support')}>Contact School</Button>
          </div>
          <div style={{ position: 'absolute', right: '-8px', bottom: '-12px', fontSize: '5rem', opacity: 0.85, transform: 'rotate(-5deg)', userSelect: 'none' }}>👨‍👩‍👧</div>
        </div>
      </div>

      {/* ── PAYMENT MODAL ── */}
      {payModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          {receipt ? (
            <div style={{ background: "var(--bg-surface)", padding: '2.5rem', borderRadius: '1.5rem', maxWidth: 400, width: '100%', textAlign: 'center', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
              <div style={{ width: 72, height: 72, background: 'var(--risk-low-bg)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}><ShieldCheck size={36} color="var(--risk-low)" /></div>
              <h2 style={{ fontSize: '1.375rem', fontWeight: 700, margin: '0 0 0.5rem' }}>Payment Successful!</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>Your fee has been received securely.</p>
              <div style={{ background: 'var(--bg-surface-hover)', padding: '0.75rem 1.25rem', borderRadius: '0.75rem', display: 'inline-block', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Receipt Number</div>
                <div style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--text-primary)' }}>{receipt}</div>
              </div>
              <Button style={{ width: '100%', background: '#0f766e' }} onClick={() => { setPayModal(null); setReceipt(null); }}>Done</Button>
            </div>
          ) : (
            <div style={{ background: "var(--bg-surface)", padding: '2rem', borderRadius: '1.5rem', maxWidth: 460, width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>Secure Checkout</h2>
                <ShieldCheck color="var(--risk-low)" />
              </div>
              <div style={{ background: 'var(--bg-surface-hover)', padding: '1.25rem', borderRadius: '1rem', marginBottom: '1.5rem', border: '1px solid var(--border-default)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Student</span>
                  <span style={{ fontWeight: 600 }}>{payModal.child.name}</span>
                </div>
                <div style={{ height: 1, background: 'var(--border-default)', margin: '0.75rem 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Amount</span>
                  <span style={{ fontSize: '1.375rem', fontWeight: 800, color: '#0f766e' }}>{fmt(feeAmount)}</span>
                </div>
              </div>
              <p style={{ fontSize: '0.813rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Payment Method</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {['ONLINE_UPI','ONLINE_CARD'].map(m => (
                  <div key={m} onClick={() => setPayModal({...payModal, method: m})} style={{ padding: '0.875rem', border: `2px solid ${payModal.method===m?'#0f766e':'var(--border-default)'}`, borderRadius: '0.75rem', cursor: 'pointer', textAlign: 'center', background: payModal.method===m?'var(--risk-low-bg)':"var(--bg-surface)", fontSize: '0.875rem', fontWeight: 600, color: payModal.method===m?'#0f766e':'var(--text-secondary)' }}>
                    {m === 'ONLINE_UPI' ? 'UPI App' : 'Card'}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <Button variant="outline" style={{ flex: 1 }} onClick={() => setPayModal(null)} disabled={paying}>Cancel</Button>
                <Button style={{ flex: 2, background: '#0f766e', color: "var(--bg-surface)" }} onClick={handlePay} disabled={paying}>
                  {paying ? 'Processing…' : `Pay ${fmt(feeAmount)}`}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
