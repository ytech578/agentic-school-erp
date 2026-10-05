/**
 * Locale Store — Agentic School ERP
 * Manages the active locale, fetches translation bundles from the API,
 * and exposes a t() helper so any component can call useLocale().t('key.path').
 */

import { create } from "zustand";
import { apiClient } from "@/lib/axios";

// ─── Types ───────────────────────────────────────────────────────────────────
export type SupportedLocale = "en" | "hi";

export interface LocaleStore {
  locale: SupportedLocale;
  translations: Record<string, any>;
  isLoading: boolean;

  /** Load the bundle for a given locale from the API */
  loadLocale: (locale: SupportedLocale) => Promise<void>;

  /** Translate a dot-separated key, e.g. "common.save" */
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ─── Inline English fallback bundle (avoids blank UI on first load) ───────────
const EN_FALLBACK: Record<string, any> = {
  common: {
    dashboard: "Dashboard", students: "Students", staff: "Staff",
    classes: "Classes", attendance: "Attendance", fees: "Fees",
    exams: "Examinations", reports: "Reports", notifications: "Notifications",
    settings: "Settings", save: "Save", cancel: "Cancel", delete: "Delete",
    edit: "Edit", submit: "Submit", search: "Search...", status: "Status",
    action: "Action",
  },
  admissions: {
    title: "Student Admissions", applyNow: "Apply for Admission",
    enquiry: "Admission Enquiry", applicationStatus: "Application Status",
    applicantName: "Applicant Name", gradeApplying: "Grade Applying For",
    parentContact: "Parent Contact Number",
    submittedSuccess: "Application submitted successfully.",
  },
  attendance: {
    title: "Daily Attendance", present: "Present", absent: "Absent",
    late: "Late", halfDay: "Half Day", onLeave: "On Leave",
    markAttendance: "Mark Attendance", attendanceRate: "Attendance Rate",
  },
  fees: {
    title: "Fee Management", totalDue: "Total Due", paid: "Paid",
    pending: "Pending", overdue: "Overdue", payNow: "Pay Now",
    receipt: "Fee Receipt", transactionId: "Transaction ID",
  },
  exams: {
    title: "Examinations & Marks", reportCard: "Student Report Card",
    subject: "Subject", marksObtained: "Marks Obtained", maxMarks: "Max Marks",
    grade: "Grade", percentage: "Percentage", result: "Result",
    pass: "Passed", fail: "Needs Improvement",
  },
  certificates: {
    transferCertificate: "Transfer Certificate", bonafide: "Bonafide Certificate",
    character: "Character Certificate",
    verifyCertificate: "Verify Certificate Authenticity",
    validCertificate: "Authentic Certificate Verified",
  },
  ptm: {
    title: "Parent-Teacher Meetings", bookSlot: "Book Meeting Slot",
    myBookings: "My Booked Slots", teacherFeedback: "Teacher Feedback & Remarks",
  },
  discipline: {
    title: "Discipline & Conduct", incidentReport: "Disciplinary Incident",
    severity: "Severity Level", remedialAction: "Action Taken",
  },
};

// ─── Helper: resolve a dot-path in an object ─────────────────────────────────
function resolvePath(obj: Record<string, any>, key: string): string | undefined {
  const keys = key.split(".");
  let cur: any = obj;
  for (const k of keys) {
    if (cur && typeof cur === "object" && k in cur) {
      cur = cur[k];
    } else {
      return undefined;
    }
  }
  return typeof cur === "string" ? cur : undefined;
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const useLocaleStore = create<LocaleStore>((set, get) => ({
  locale: "en",
  translations: EN_FALLBACK,
  isLoading: false,

  loadLocale: async (locale: SupportedLocale) => {
    // Persist immediately so the UI button updates instantly
    if (typeof window !== "undefined") {
      localStorage.setItem("erp_locale", locale);
    }
    set({ locale, isLoading: true });

    try {
      // Correct API endpoint: GET /i18n/:locale
      const res = await apiClient.get(`/i18n/${locale}`);
      const bundle = res.data?.data || res.data;
      if (bundle && typeof bundle === "object") {
        set({ translations: bundle, isLoading: false });
      } else {
        // Fallback to English inline bundle if API returns unexpected shape
        set({ translations: locale === "en" ? EN_FALLBACK : EN_FALLBACK, isLoading: false });
      }
    } catch {
      // Network error — keep inline fallback
      set({ translations: EN_FALLBACK, isLoading: false });
    }

    // Broadcast locale change so legacy listeners still work
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("erp_locale_change", { detail: { locale } }));
    }
  },

  t: (key: string, params?: Record<string, string | number>): string => {
    const { translations } = get();
    let value = resolvePath(translations, key);

    // Fallback to English inline if missing in loaded bundle
    if (value === undefined) {
      value = resolvePath(EN_FALLBACK, key);
    }

    if (value === undefined) return key; // last resort: show the key itself

    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(new RegExp(`{${k}}`, "g"), String(v));
      }
    }

    return value;
  },
}));

// ─── Bootstrap: hydrate locale from localStorage on module load ───────────────
if (typeof window !== "undefined") {
  const saved = localStorage.getItem("erp_locale") as SupportedLocale | null;
  if (saved && saved !== "en") {
    // Defer so the store is fully initialized first
    setTimeout(() => {
      useLocaleStore.getState().loadLocale(saved);
    }, 0);
  }
}
