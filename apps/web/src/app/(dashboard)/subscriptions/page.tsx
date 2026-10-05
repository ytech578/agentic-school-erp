"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useAuthStore } from "@/store/auth.store";
import { 
  Sparkles, 
  Check, 
  CheckCircle2, 
  Zap, 
  Database, 
  Users, 
  GraduationCap, 
  Bot, 
  ShieldCheck, 
  ArrowRight,
  TrendingUp,
  AlertCircle,
  RefreshCw
} from "lucide-react";

interface SubscriptionData {
  subscription?: {
    id: string;
    schoolId: string;
    plan: "FREE_PILOT" | "STARTER" | "GROWTH" | "ENTERPRISE" | string;
    status: string;
    maxStudents: number;
    maxStaff: number;
    maxStorageGb: number;
    maxAiTokensMonthly: number;
    currentAiTokensUsed: number;
    currentStorageGbUsed: number;
    startDate?: string;
    renewsAt?: string;
    billingCycle?: string;
  };
  billingCycle?: string;
  renewsAt?: string;
  metrics?: {
    students: { used: number; limit: number; percent: number };
    staff: { used: number; limit: number; percent: number };
    storage: { usedGb: number; limitGb: number; percent: number };
    aiTokens: { used: number; limit: number; percent: number };
  };
  planTier?: string;
}

export default function SubscriptionsPage() {
  const { user } = useAuthStore();
  const [sub, setSub] = useState<SubscriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [selectedPlanForUpgrade, setSelectedPlanForUpgrade] = useState<string>("GROWTH");

  const canManageSubscription =
    user?.role === "SUPER_ADMIN" ||
    user?.role === "SCHOOL_ADMIN" ||
    user?.role === "PRINCIPAL";

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get("/subscriptions");
      const raw = res.data;
      const subData =
        raw?.data?.subscription
          ? raw.data
          : raw?.subscription
            ? raw
            : raw?.data || raw || null;
      setSub(subData);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      const message =
        errorObj.response?.data?.message ||
        errorObj.message ||
        "Unable to load subscription details. Please verify your connection.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const subscription = sub?.subscription || (sub as any);
  const metrics = sub?.metrics;

  const planTier = subscription?.plan || sub?.planTier || "FREE_PILOT";
  const studentUsed = metrics?.students?.used ?? 0;
  const studentQuota = metrics?.students?.limit ?? subscription?.maxStudents ?? 200;
  const studentPct = metrics?.students?.percent ?? (studentQuota > 0 ? Math.min(100, Math.round((studentUsed / studentQuota) * 100)) : 0);

  const staffUsed = metrics?.staff?.used ?? 0;
  const staffQuota = metrics?.staff?.limit ?? subscription?.maxStaff ?? 30;
  const staffPct = metrics?.staff?.percent ?? (staffQuota > 0 ? Math.min(100, Math.round((staffUsed / staffQuota) * 100)) : 0);

  const storageUsed = metrics?.storage?.usedGb ?? subscription?.currentStorageGbUsed ?? 0;
  const storageQuota = metrics?.storage?.limitGb ?? subscription?.maxStorageGb ?? 5;
  const storagePct = metrics?.storage?.percent ?? (storageQuota > 0 ? Math.min(100, Math.round((storageUsed / storageQuota) * 100)) : 0);

  const aiDailyUsed = metrics?.aiTokens?.used ?? subscription?.currentAiTokensUsed ?? 0;
  const aiDailyQuota = metrics?.aiTokens?.limit ?? subscription?.maxAiTokensMonthly ?? 500000;
  const aiPct = metrics?.aiTokens?.percent ?? (aiDailyQuota > 0 ? Math.min(100, Math.round((aiDailyUsed / aiDailyQuota) * 100)) : 0);

  const handleRequestUpgrade = async () => {
    try {
      const targetSchoolId =
        subscription?.schoolId ||
        (typeof window !== "undefined" ? localStorage.getItem("selected_school_id") : null);
      if (targetSchoolId) {
        await apiClient.put(`/subscriptions/${targetSchoolId}`, {
          plan: selectedPlanForUpgrade,
        });
      } else {
        await apiClient.post("/subscriptions/upgrade", {
          plan: selectedPlanForUpgrade,
        });
      }
      alert(`Plan tier successfully upgraded to ${selectedPlanForUpgrade}! Quotas have been expanded in database.`);
      setIsUpgradeModalOpen(false);
      fetchSubscription();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      alert(errorObj?.response?.data?.message || "Failed to process plan upgrade request");
    }
  };

  const PLANS = [
    {
      tier: "FREE_PILOT",
      name: "Pilot Campus",
      price: "₹0 / Free",
      studentCap: "Up to 200 Students",
      staffCap: "30 Staff Accounts",
      storage: "5 GB Cloud Storage",
      features: [
        "Core Academic Modules",
        "Student & Staff Attendance",
        "Fee Management & Razorpay",
        "Standard Timetable Generator",
      ],
      highlight: false,
    },
    {
      tier: "STARTER",
      name: "Growth School",
      price: "₹24,000 / yr",
      studentCap: "Up to 500 Students",
      staffCap: "60 Staff Accounts",
      storage: "20 GB Cloud Storage",
      features: [
        "Everything in Pilot",
        "Online Exams & Question Bank",
        "Certificates (TC & Bonafide) with QR",
        "PTM Slot Booking & Feedback",
        "Discipline & Behavioral Tracking",
      ],
      highlight: false,
    },
    {
      tier: "GROWTH",
      name: "Institutional Pro",
      price: "₹54,000 / yr",
      studentCap: "Up to 1,500 Students",
      staffCap: "150 Staff Accounts",
      storage: "100 GB Cloud Storage",
      features: [
        "Everything in Growth School",
        "Agentic AI Copilot & Risk Scoring",
        "Automated EPF/ESI/TDS Payroll Engine",
        "DPDP Act 2023 Compliance Center",
        "Alumni Network & Digital Transcripts",
        "5 Million Monthly AI Tokens",
      ],
      highlight: true,
    },
    {
      tier: "ENTERPRISE",
      name: "Multi-Campus Fleet",
      price: "₹1,20,000 / yr",
      studentCap: "5,000+ Students",
      staffCap: "500 Staff Accounts",
      storage: "500 GB Cloud Storage",
      features: [
        "Everything in Institutional Pro",
        "Global Fleet Cross-Campus Aggregation",
        "Dedicated Database Shard & VPC",
        "Custom SLA & Priority 24/7 Support",
        "20 Million Monthly AI Tokens",
      ],
      highlight: false,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Sparkles className="text-brand" size={26} />
            SaaS Subscription & Resource Metering
          </h1>
          <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Enterprise multi-tenant subscription tiers, student/staff quotas, storage metering, and AI consumption
          </p>
        </div>

        {canManageSubscription && (
          <Button
            icon={<Zap size={16} />}
            onClick={() => setIsUpgradeModalOpen(true)}
          >
            Upgrade / Change Plan
          </Button>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.875rem 1.25rem",
            borderRadius: "var(--radius-lg)",
            backgroundColor: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            color: "var(--danger)",
            fontSize: "0.875rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
          <Button size="sm" variant="outline" onClick={fetchSubscription}>
            <RefreshCw size={14} style={{ marginRight: "0.35rem" }} />
            Retry
          </Button>
        </div>
      )}

      {/* Current Subscription Card */}
      <div
        className="card"
        style={{
          padding: "1.75rem",
          background: "linear-gradient(135deg, rgba(37,99,235,0.06) 0%, rgba(8,145,178,0.06) 100%)",
          border: "1px solid var(--border-light)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span
                style={{
                  background: "var(--brand-gradient)",
                  color: "white",
                  padding: "0.25rem 0.75rem",
                  borderRadius: "var(--radius-full)",
                  fontSize: "0.8rem",
                  fontWeight: 800,
                  letterSpacing: "0.05em",
                }}
              >
                {planTier} TIER
              </span>
              <span style={{ fontSize: "0.8rem", color: "var(--success-dark)", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <CheckCircle2 size={14} /> Active License
              </span>
            </div>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 800, margin: "0.5rem 0 0.25rem" }}>
              Agentic School ERP — {planTier.charAt(0) + planTier.slice(1).toLowerCase()} Subscription
            </h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: 0 }}>
              Billing Cycle: {sub?.billingCycle || subscription?.billingCycle || "Annual"} | Renews On:{" "}
              {(sub?.renewsAt || subscription?.renewsAt) ? new Date((sub?.renewsAt || subscription?.renewsAt) as string).toLocaleDateString() : "March 31, 2027"}
            </p>
          </div>

          {canManageSubscription && (
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsUpgradeModalOpen(true)}
              >
                Modify Quotas
              </Button>
            </div>
          )}
        </div>

        {/* Metering Progress Bars */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.5rem", marginTop: "1.5rem" }}>
          {/* Active Students */}
          <div style={{ background: "var(--bg-surface)", padding: "1rem", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <GraduationCap size={15} /> Students Enrolled
              </span>
              <span style={{ fontSize: "0.8rem", fontWeight: 800 }}>{studentUsed} / {studentQuota}</span>
            </div>
            <div style={{ height: "8px", width: "100%", background: "var(--bg-surface-hover)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${studentPct}%`,
                  background: studentPct > 90 ? "var(--danger)" : "var(--brand-blue)",
                  borderRadius: "var(--radius-full)",
                  transition: "width 0.3s",
                }}
              />
            </div>
            <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginTop: "0.4rem", display: "block" }}>
              {100 - studentPct}% quota capacity remaining
            </span>
          </div>

          {/* Staff Accounts */}
          <div style={{ background: "var(--bg-surface)", padding: "1rem", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <Users size={15} /> Staff Accounts
              </span>
              <span style={{ fontSize: "0.8rem", fontWeight: 800 }}>{staffUsed} / {staffQuota}</span>
            </div>
            <div style={{ height: "8px", width: "100%", background: "var(--bg-surface-hover)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${staffPct}%`,
                  background: staffPct > 90 ? "var(--danger)" : "var(--teal-500)",
                  borderRadius: "var(--radius-full)",
                  transition: "width 0.3s",
                }}
              />
            </div>
            <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginTop: "0.4rem", display: "block" }}>
              {100 - staffPct}% quota capacity remaining
            </span>
          </div>

          {/* Cloud Storage */}
          <div style={{ background: "var(--bg-surface)", padding: "1rem", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <Database size={15} /> AWS S3 Storage
              </span>
              <span style={{ fontSize: "0.8rem", fontWeight: 800 }}>{storageUsed} GB / {storageQuota} GB</span>
            </div>
            <div style={{ height: "8px", width: "100%", background: "var(--bg-surface-hover)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${storagePct}%`,
                  background: storagePct > 90 ? "var(--danger)" : "var(--primary-600)",
                  borderRadius: "var(--radius-full)",
                  transition: "width 0.3s",
                }}
              />
            </div>
            <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginTop: "0.4rem", display: "block" }}>
              Encrypted document & certificate store
            </span>
          </div>

          {/* AI Inference Quota */}
          <div style={{ background: "var(--bg-surface)", padding: "1rem", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <Bot size={15} /> AI Daily Quota
              </span>
              <span style={{ fontSize: "0.8rem", fontWeight: 800 }}>{aiDailyUsed} / {aiDailyQuota}</span>
            </div>
            <div style={{ height: "8px", width: "100%", background: "var(--bg-surface-hover)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${aiPct}%`,
                  background: aiPct > 90 ? "var(--danger)" : "var(--teal-600)",
                  borderRadius: "var(--radius-full)",
                  transition: "width 0.3s",
                }}
              />
            </div>
            <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginTop: "0.4rem", display: "block" }}>
              Resets daily at 00:00 IST
            </span>
          </div>
        </div>
      </div>

      {/* Plan Tiers Comparison Grid */}
      <div>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: "0 0 1rem" }}>Available Enterprise Plans</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.25rem" }}>
          {PLANS.map((plan) => {
            const isCurrent = plan.tier === planTier;

            return (
              <div
                key={plan.tier}
                className="card"
                style={{
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  border: isCurrent ? "2px solid var(--primary-600)" : "1px solid var(--border-default)",
                  position: "relative",
                  background: plan.highlight ? "var(--primary-50)" : "var(--bg-surface)",
                }}
              >
                {isCurrent && (
                  <span
                    style={{
                      position: "absolute",
                      top: "-10px",
                      right: "15px",
                      background: "var(--primary-600)",
                      color: "white",
                      fontSize: "0.7rem",
                      fontWeight: 800,
                      padding: "0.2rem 0.6rem",
                      borderRadius: "var(--radius-full)",
                    }}
                  >
                    CURRENT PLAN
                  </span>
                )}

                <div>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0 }}>{plan.name}</h3>
                  <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text-primary)", margin: "0.5rem 0" }}>
                    {plan.price}
                  </div>

                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
                    <div>• {plan.studentCap}</div>
                    <div>• {plan.staffCap}</div>
                    <div>• {plan.storage}</div>
                  </div>

                  <div style={{ borderTop: "1px solid var(--border-default)", paddingTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    {plan.features.map((feat, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem" }}>
                        <Check size={14} style={{ color: "var(--success)" }} />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {canManageSubscription ? (
                  <div style={{ marginTop: "1.5rem" }}>
                    <Button
                      variant={isCurrent ? "outline" : "primary"}
                      style={{ width: "100%" }}
                      onClick={() => {
                        setSelectedPlanForUpgrade(plan.tier);
                        setIsUpgradeModalOpen(true);
                      }}
                    >
                      {isCurrent ? "Manage Plan" : "Choose Plan"}
                    </Button>
                  </div>
                ) : (
                  <div style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.8rem", color: "var(--text-tertiary)" }}>
                    {isCurrent ? "Active Campus Plan" : "Admin Managed Tier"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upgrade Modal */}
      <Modal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        title="Upgrade School Plan & Quotas"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>
              Select Plan Tier
            </label>
            <select
              value={selectedPlanForUpgrade}
              onChange={(e) => setSelectedPlanForUpgrade(e.target.value)}
              className="input-field"
              style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}
            >
              <option value="FREE_PILOT">FREE PILOT (200 Students, 30 Staff, 5 GB Storage)</option>
              <option value="STARTER">STARTER (500 Students, 60 Staff, 20 GB Storage)</option>
              <option value="GROWTH">GROWTH (1,500 Students, 150 Staff, 100 GB Storage, AI Suite)</option>
              <option value="ENTERPRISE">ENTERPRISE (5,000+ Students, 500 Staff, 500 GB Storage, Fleet VPC)</option>
            </select>
          </div>

          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
            Upgrading your plan automatically adjusts student admissions quotas, cloud document storage allocations, and unlocks advanced AI modules immediately.
          </p>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
            <Button variant="ghost" onClick={() => setIsUpgradeModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRequestUpgrade} icon={<Zap size={15} />}>
              Confirm Upgrade
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
