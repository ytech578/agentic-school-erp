"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  BookOpen, MessageSquare, Mail, Sparkles, Loader2, Copy, Check, 
  Download, FileText, CheckCircle2, AlertCircle, ArrowRight,
  Wand2, Maximize2, Minimize2, Printer
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

import { cleanLatexMath, formatCopilotMarkdown } from "@/lib/latex-formatter";
import PrintableQuestionPaperModal from "@/components/exams/PrintableQuestionPaperModal";
import PrintableLessonPlanModal from "@/components/teacher/PrintableLessonPlanModal";

type CopilotTab = "lesson" | "remark" | "parent" | "paper";

export default function TeacherCopilotPage() {
  const [activeTab, setActiveTab] = useState<CopilotTab>("lesson");
  
  // Lesson Plan State
  const [topic, setTopic] = useState("");
  const [grade, setGrade] = useState("Grade 8");
  const [duration, setDuration] = useState("45 mins");
  const [curriculum, setCurriculum] = useState("CBSE / General");
  const [includeTlm, setIncludeTlm] = useState(true);
  
  // Remark State
  const [studentName, setStudentName] = useState("");
  const [studentProfile, setStudentProfile] = useState("");
  const [tone, setTone] = useState("Encouraging");
  const [performanceLevel, setPerformanceLevel] = useState("Good");
  
  // Parent Update State
  const [parentStudent, setParentStudent] = useState("");
  const [parentContext, setParentContext] = useState("");
  const [updateChannel, setUpdateChannel] = useState<"whatsapp" | "email" | "sms">("whatsapp");

  // Exam Question Paper State
  const [paperGrade, setPaperGrade] = useState("Class 10");
  const [paperSubject, setPaperSubject] = useState("Mathematics");
  const [paperTotalMarks, setPaperTotalMarks] = useState(80);
  const [paperDuration, setPaperDuration] = useState("3 Hours");
  const [paperDifficulty, setPaperDifficulty] = useState("BALANCED");
  const [paperTopics, setPaperTopics] = useState("Quadratic Equations, Polynomials, Coordinate Geometry");
  const [paperIncludeAnswerKey, setPaperIncludeAnswerKey] = useState(true);
  const [paperBoard, setPaperBoard] = useState("CBSE");
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showLessonPlanPrintModal, setShowLessonPlanPrintModal] = useState(false);
  const [copiedStudentHandout, setCopiedStudentHandout] = useState(false);
  const [schoolName, setSchoolName] = useState<string>("");

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // In-Place Same Window Expansion State
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch active school name for question paper letterhead and prompts
  useEffect(() => {
    apiClient
      .get("/schools/current")
      .then((res) => {
        const name = res.data?.data?.name || res.data?.name;
        if (name) setSchoolName(name);
      })
      .catch(() => {
        // Graceful fallback to default institution
      });
  }, []);

  // Listen for Escape key to collapse expanded view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isExpanded) {
        setIsExpanded(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  // Quick Lesson Presets
  const lessonPresets = [
    { title: "Photosynthesis & Respiration", grade: "Grade 7", duration: "45 mins" },
    { title: "Quadratic Equations & Graphs", grade: "Grade 10", duration: "60 mins" },
    { title: "Newton's Laws of Motion", grade: "Grade 9", duration: "45 mins" },
    { title: "Shakespeare: Merchant of Venice", grade: "Grade 10", duration: "60 mins" },
    { title: "Indian Freedom Movement 1947", grade: "Grade 8", duration: "45 mins" },
    { title: "Python Basics: Conditionals", grade: "Grade 9", duration: "45 mins" },
  ];

  // Quick Question Paper Presets (Strictly Nursery - Grade 10)
  const paperPresets = [
    { grade: "Class 10", subject: "Mathematics", marks: 80, duration: "3 Hours", topics: "Quadratic Equations, Real Numbers, Triangles, Statistics" },
    { grade: "Class 9", subject: "Science", marks: 80, duration: "3 Hours", topics: "Matter in Our Surroundings, Force & Laws of Motion, Cell Biology" },
    { grade: "Class 8", subject: "Social Science", marks: 50, duration: "1.5 Hours", topics: "Resources, Modern Indian History, Indian Constitution" },
    { grade: "Class 6", subject: "English", marks: 50, duration: "1.5 Hours", topics: "Reading Comprehension, Prepositions, Story Writing" },
  ];

  // Quick Remark Traits
  const remarkTraits = [
    "Consistently submits high quality homework",
    "Active participant in class discussions",
    "Creative analytical problem solver",
    "Needs to double-check calculations",
    "Easily distracted during group activities",
    "Displays strong leadership among peers",
    "Steadily improving in exam confidence",
  ];

  // Quick Parent Scenarios
  const parentScenarios = [
    { label: "Attendance Alert (3 Days Absent)", context: "Student has been absent for 3 consecutive days without prior leave application. Inquiring regarding health and missing schoolwork." },
    { label: "High Test Score Commendation", context: "Congratulations on scoring 96% in the recent midterm mathematics exam. Excellent classroom dedication!" },
    { label: "Pending Homework Reminder", context: "Reminder regarding the pending science lab project due this Friday. Kindly ensure timely submission." },
    { label: "PTM Meeting Invitation", context: "Invitation to schedule a slot for the upcoming Parent-Teacher Conference next Saturday." },
  ];

  const handleGenerate = async (customPromptOverride?: string) => {
    setIsLoading(true);
    setResult(null);
    setCopied(false);
    setErrorMessage(null);
    
    try {
      let endpoint = "";
      let payload: any = {};

      if (activeTab === "lesson") {
        endpoint = "/ai/copilot/lesson-plan";
        payload = { 
          topic: customPromptOverride || topic, 
          grade, 
          duration,
          includeTlm,
          subject: topic,
          curriculum
        };
      } else if (activeTab === "remark") {
        endpoint = "/ai/copilot/remark";
        const combinedProfile = studentName 
          ? `Student: ${studentName}. Performance: ${performanceLevel}. Observations: ${studentProfile}` 
          : `Performance: ${performanceLevel}. Observations: ${studentProfile}`;
        payload = { studentProfile: customPromptOverride || combinedProfile, tone };
      } else if (activeTab === "parent") {
        endpoint = "/ai/copilot/parent-update";
        const channelNote = updateChannel === "whatsapp" ? "Format for WhatsApp" : updateChannel === "email" ? "Format as Formal Email" : "Format as Short SMS";
        payload = { 
          studentProfile: parentStudent || "Student", 
          context: `${parentContext} [${channelNote}]` 
        };
      } else if (activeTab === "paper") {
        endpoint = "/ai/copilot/question-paper";
        payload = { 
          grade: paperGrade, 
          subject: paperSubject, 
          totalMarks: Number(paperTotalMarks), 
          duration: paperDuration, 
          difficulty: paperDifficulty, 
          topics: customPromptOverride || paperTopics, 
          includeAnswerKey: paperIncludeAnswerKey, 
          board: paperBoard,
          schoolName: schoolName || undefined,
        };
      }

      // Comprehensive 120s timeout ensures deep reasoning models finish complex CBSE papers reliably
      const response = await apiClient.post(endpoint, payload, { timeout: 120000 });
      const data = response.data.data || response.data;
      setResult(data.result);
    } catch (error: any) {
      console.error("Failed to generate:", error);
      setErrorMessage(error?.response?.data?.message || "Error generating AI response. Please check inputs and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Preprocess Markdown with LaTeX math cleaner and table fixer
  const cleanResult = useMemo(() => {
    return result ? formatCopilotMarkdown(result) : "";
  }, [result]);

  const copyToClipboard = () => {
    if (cleanResult) {
      navigator.clipboard.writeText(cleanResult);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyStudentHandout = () => {
    if (!cleanResult) return;
    const worksheetHeaderRegex = /(?:^|\n)(?:---+|\*\*\*+)?\s*(#{1,3}\s*(?:📄\s*)?(?:Student\s+Classroom\s+Activity\s+Handout|Student\s+Activity\s+Handout|Student\s+Worksheet)[^\n]*)/i;
    const match = cleanResult.match(worksheetHeaderRegex);
    const handout = match && match.index !== undefined ? cleanResult.slice(match.index).trim() : cleanResult;
    navigator.clipboard.writeText(handout);
    setCopiedStudentHandout(true);
    setTimeout(() => setCopiedStudentHandout(false), 2000);
  };

  const downloadMarkdown = () => {
    if (!cleanResult) return;
    const blob = new Blob([cleanResult], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeTab}_${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const wordCount = cleanResult ? cleanResult.trim().split(/\s+/).filter(Boolean).length : 0;
  const charCount = cleanResult ? cleanResult.length : 0;

  // Custom markdown styling components
  const markdownComponents = {
    h1: ({ node, children, ...props }: any) => {
      const text = typeof children === "string" ? children : Array.isArray(children) ? children.join("") : "";
      const isAnswerKey = /marking\s*scheme|answer\s*key/i.test(text);
      if (isAnswerKey) {
        return (
          <div style={{ marginTop: "2rem", marginBottom: "1rem" }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.75rem 1rem",
              borderRadius: "var(--radius-lg)",
              background: "rgba(99, 102, 241, 0.08)",
              border: "1.5px dashed var(--brand-primary)",
              marginBottom: "0.75rem"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.2rem" }}>📝</span>
                <span style={{ fontWeight: 700, color: "var(--brand-primary)", fontSize: "var(--text-sm)" }}>
                  Evaluator Marking Scheme & Scoring Key
                </span>
              </div>
              <span style={{
                fontSize: "11px",
                fontWeight: 700,
                background: "var(--brand-primary)",
                color: "#FFFFFF",
                padding: "2px 8px",
                borderRadius: "999px",
                letterSpacing: "0.03em"
              }}>
                Starts on New Page in Print / PDF
              </span>
            </div>
            <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.75rem" }} {...props}>
              {children}
            </h1>
          </div>
        );
      }
      return <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: "var(--text-primary)", marginTop: "1.25rem", marginBottom: "0.75rem" }} {...props}>{children}</h1>;
    },
    h2: ({ node, children, ...props }: any) => {
      const text = typeof children === "string" ? children : Array.isArray(children) ? children.join("") : "";
      const isTlm = /TLM|Teaching Learning Material/i.test(text);
      if (isTlm) {
        return (
          <div style={{
            marginTop: "1.75rem",
            marginBottom: "1rem",
            padding: "0.875rem 1.25rem",
            borderRadius: "var(--radius-lg)",
            background: "linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(59, 130, 246, 0.08))",
            border: "1.5px solid rgba(99, 102, 241, 0.35)",
            boxShadow: "0 4px 15px rgba(99, 102, 241, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.5rem"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <span style={{ fontSize: "1.35rem" }}>📦</span>
              <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 800, color: "var(--text-primary)", margin: 0 }} {...props}>
                {children}
              </h2>
            </div>
            <span style={{
              fontSize: "11px",
              fontWeight: 700,
              background: "linear-gradient(135deg, #6366F1, #3B82F6)",
              color: "#FFFFFF",
              padding: "3px 10px",
              borderRadius: "999px",
              letterSpacing: "0.04em",
              textTransform: "uppercase"
            }}>
              Pedagogical Hands-on Kit
            </span>
          </div>
        );
      }
      return <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--brand-primary)", marginTop: "1.25rem", marginBottom: "0.5rem", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.35rem" }} {...props}>{children}</h2>;
    },
    h3: ({ node, children, ...props }: any) => {
      const text = typeof children === "string" ? children : Array.isArray(children) ? children.join("") : "";
      const isTlm = /TLM|Teaching Learning Material/i.test(text);
      if (isTlm) {
        return (
          <div style={{
            marginTop: "1.75rem",
            marginBottom: "1rem",
            padding: "0.875rem 1.25rem",
            borderRadius: "var(--radius-lg)",
            background: "linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(59, 130, 246, 0.08))",
            border: "1.5px solid rgba(99, 102, 241, 0.35)",
            boxShadow: "0 4px 15px rgba(99, 102, 241, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.5rem"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <span style={{ fontSize: "1.35rem" }}>📦</span>
              <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 800, color: "var(--text-primary)", margin: 0 }} {...props}>
                {children}
              </h3>
            </div>
            <span style={{
              fontSize: "11px",
              fontWeight: 700,
              background: "linear-gradient(135deg, #6366F1, #3B82F6)",
              color: "#FFFFFF",
              padding: "3px 10px",
              borderRadius: "999px",
              letterSpacing: "0.04em",
              textTransform: "uppercase"
            }}>
              Pedagogical Hands-on Kit
            </span>
          </div>
        );
      }
      return <h3 style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--text-primary)", marginTop: "1rem", marginBottom: "0.375rem" }} {...props}>{children}</h3>;
    },
    h4: ({ node, ...props }: any) => <h4 style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-secondary)", marginTop: "0.75rem", marginBottom: "0.25rem" }} {...props} />,
    p: ({ node, ...props }: any) => <p style={{ marginBottom: "0.875rem", lineHeight: 1.7 }} {...props} />,
    table: ({ node, ...props }: any) => (
      <div style={{ overflowX: "auto", margin: "1.25rem 0", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-xs)", background: "var(--bg-surface)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-xs)", textAlign: "left" }} {...props} />
      </div>
    ),
    thead: ({ node, ...props }: any) => <thead style={{ background: "var(--bg-app)", borderBottom: "2px solid var(--border-default)" }} {...props} />,
    th: ({ node, ...props }: any) => <th style={{ padding: "0.625rem 0.875rem", fontWeight: 700, color: "var(--text-primary)", borderRight: "1px solid var(--border-default)" }} {...props} />,
    td: ({ node, ...props }: any) => <td style={{ padding: "0.625rem 0.875rem", borderTop: "1px solid var(--border-default)", borderRight: "1px solid var(--border-default)", verticalAlign: "top", lineHeight: 1.55 }} {...props} />,
    ul: ({ node, ...props }: any) => <ul style={{ paddingLeft: "1.5rem", margin: "0.625rem 0", listStyleType: "disc" }} {...props} />,
    ol: ({ node, ...props }: any) => <ol style={{ paddingLeft: "1.5rem", margin: "0.625rem 0", listStyleType: "decimal" }} {...props} />,
    li: ({ node, ...props }: any) => <li style={{ marginBottom: "0.35rem" }} {...props} />,
    hr: ({ node, ...props }: any) => <hr style={{ border: "none", borderTop: "1px solid var(--border-default)", margin: "1.25rem 0" }} {...props} />,
    blockquote: ({ node, ...props }: any) => (
      <blockquote style={{ borderLeft: "3px solid var(--brand-primary)", background: "var(--brand-blue-subtle)", padding: "0.625rem 1rem", margin: "0.875rem 0", borderRadius: "0 var(--radius-md) var(--radius-md) 0", color: "var(--text-primary)", fontSize: "var(--text-xs)" }} {...props} />
    ),
    code: ({ node, ...props }: any) => (
      <code style={{ background: "var(--bg-app)", color: "var(--brand-primary)", padding: "0.15rem 0.4rem", borderRadius: "var(--radius-xs)", fontSize: "0.875em", fontFamily: "monospace", border: "1px solid var(--border-subtle)" }} {...props} />
    ),
  };

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Scoped Keyframes & Animation Boosts */}
      <style>{`
        @keyframes copilotShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes copilotFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes copilotInPlaceExpand {
          0% {
            opacity: 0.9;
            transform: scale(0.99);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        .copilot-tooltip-wrapper {
          position: relative;
          display: inline-flex;
        }
        .copilot-tooltip-badge {
          position: absolute;
          bottom: -32px;
          right: 50%;
          transform: translateX(50%) translateY(4px);
          background: #0F172A;
          color: #FFFFFF;
          font-size: 11px;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 6px;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s ease;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
          z-index: 50;
        }
        .copilot-tooltip-wrapper:hover .copilot-tooltip-badge {
          opacity: 1;
          visibility: visible;
          transform: translateX(50%) translateY(0);
        }
      `}</style>

      {/* Hero Header Banner */}
      <div style={{
        background: "linear-gradient(135deg, #0D1B36 0%, #162B54 50%, #0F355C 100%)",
        borderRadius: "var(--radius-2xl)",
        padding: "2rem 2.25rem",
        color: "#FFFFFF",
        boxShadow: "var(--shadow-lg), var(--agentic-glow)",
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "1.5rem",
        position: "relative",
        overflow: "hidden",
        border: "1px solid rgba(255, 255, 255, 0.1)"
      }}>
        {/* Ambient background decoration */}
        <div style={{
          position: "absolute",
          top: "-30px",
          right: "-30px",
          width: "200px",
          height: "200px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(37, 99, 235, 0.25) 0%, transparent 70%)",
          pointerEvents: "none"
        }} />

        <div style={{ zIndex: 1, maxWidth: "680px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "rgba(37, 99, 235, 0.25)", border: "1px solid rgba(96, 165, 250, 0.4)", borderRadius: "var(--radius-full)", padding: "0.25rem 0.75rem", marginBottom: "0.75rem" }}>
            <Sparkles size={14} style={{ color: "#60A5FA" }} />
            <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "#93C5FD", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Teacher Intelligence Hub
            </span>
          </div>
          <h1 style={{ fontSize: "var(--text-3xl)", fontWeight: 800, letterSpacing: "-0.03em", color: "#FFFFFF", marginBottom: "0.5rem" }}>
            Teacher CoPilot
          </h1>
          <p style={{ color: "#CBD5E1", fontSize: "var(--text-sm)", lineHeight: 1.6 }}>
            Empowering modern educators with instant lesson planning, insightful report remarks, and personalized parent communication — built directly into your academic workflows.
          </p>
        </div>

        {/* Quick Module Navigation Buttons */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", zIndex: 1 }}>
          <Link
            href="/teacher-copilot/assignments"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "rgba(255, 255, 255, 0.1)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              color: "#FFFFFF",
              padding: "0.625rem 1.125rem",
              borderRadius: "var(--radius-xl)",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              textDecoration: "none",
              transition: "all var(--duration-fast)",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.18)")}
            onMouseOut={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)")}
          >
            <FileText size={16} />
            Assignments Manager
            <ArrowRight size={14} style={{ opacity: 0.7 }} />
          </Link>
          <Link
            href="/teacher-copilot/marks"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "linear-gradient(135deg, #2563EB 0%, #0891B2 100%)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              color: "#FFFFFF",
              padding: "0.625rem 1.125rem",
              borderRadius: "var(--radius-xl)",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              textDecoration: "none",
              boxShadow: "0 4px 12px rgba(37, 99, 235, 0.4)",
              transition: "all var(--duration-fast)",
            }}
            onMouseOver={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
            onMouseOut={(e) => (e.currentTarget.style.transform = "none")}
          >
            <CheckCircle2 size={16} />
            Bulk Marks Entry
            <ArrowRight size={14} style={{ opacity: 0.7 }} />
          </Link>
        </div>
      </div>

      {/* Mode Selector Tabs */}
      <div style={{
        display: "flex",
        background: "var(--bg-surface)",
        padding: "0.375rem",
        borderRadius: "var(--radius-xl)",
        border: "1px solid var(--border-default)",
        gap: "0.375rem",
        boxShadow: "var(--shadow-sm)",
      }}>
        {[
          { id: "lesson", label: "Lesson Planner", icon: BookOpen, desc: "Objectives, timelines & exercises" },
          { id: "remark", label: "Remark Generator", icon: MessageSquare, desc: "Personalized report remarks" },
          { id: "parent", label: "Parent Update Drafter", icon: Mail, desc: "WhatsApp & email notices" },
          { id: "paper", label: "Exam Blueprinter", icon: FileText, desc: "K-10 papers & marking keys" },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as CopilotTab);
                setResult(null);
                setErrorMessage(null);
              }}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.75rem 1rem",
                borderRadius: "var(--radius-lg)",
                border: "none",
                cursor: "pointer",
                background: isActive ? "var(--brand-primary)" : "transparent",
                color: isActive ? "#FFFFFF" : "var(--text-secondary)",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                textAlign: "left",
              }}
            >
              <div style={{
                padding: "0.5rem",
                borderRadius: "var(--radius-md)",
                background: isActive ? "rgba(255, 255, 255, 0.2)" : "var(--slate-100)",
                color: isActive ? "#FFFFFF" : "var(--brand-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s ease",
              }}>
                <Icon size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>{tab.label}</div>
                <div style={{ fontSize: "var(--text-xs)", opacity: isActive ? 0.85 : 0.65 }}>{tab.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Workspace: Smooth In-Place Expansion Transition */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: isExpanded ? "1fr" : "repeat(auto-fit, minmax(360px, 1fr))", 
        gap: "1.75rem", 
        alignItems: "start",
        transition: "all 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
      }}>
        {/* Left Column: Input Form & Quick Presets (Smoothly collapses when expanded) */}
        {!isExpanded && (
          <div style={{
            background: "var(--bg-surface)",
            borderRadius: "var(--radius-2xl)",
            border: "1px solid var(--border-default)",
            padding: "1.75rem",
            boxShadow: "var(--shadow-card)",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
            animation: "copilotFadeIn 0.3s ease-out",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {activeTab === "lesson" && <><BookOpen size={20} style={{ color: "var(--brand-primary)" }} /> Plan a Lesson</>}
                {activeTab === "remark" && <><MessageSquare size={20} style={{ color: "var(--brand-primary)" }} /> Generate Student Remark</>}
                {activeTab === "parent" && <><Mail size={20} style={{ color: "var(--brand-primary)" }} /> Draft Parent Update</>}
                {activeTab === "paper" && <><FileText size={20} style={{ color: "var(--brand-primary)" }} /> Blueprint & Question Paper</>}
              </h2>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", fontWeight: 500 }}>
                AI Model: Gemini 2.0 Flash
              </span>
            </div>

            {/* TAB 1: Lesson Planner */}
            {activeTab === "lesson" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {/* Quick Topic Chips */}
                <div>
                  <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem", display: "block" }}>
                    Quick Topic Inspirations
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                    {lessonPresets.map((preset) => (
                      <button
                        key={preset.title}
                        type="button"
                        onClick={() => {
                          setTopic(preset.title);
                          setGrade(preset.grade);
                          setDuration(preset.duration);
                        }}
                        style={{
                          fontSize: "var(--text-xs)",
                          padding: "0.3rem 0.6rem",
                          borderRadius: "var(--radius-full)",
                          border: "1px solid var(--border-default)",
                          background: topic === preset.title ? "var(--brand-blue-subtle)" : "var(--bg-app)",
                          color: topic === preset.title ? "var(--brand-primary)" : "var(--text-secondary)",
                          cursor: "pointer",
                          fontWeight: 500,
                          transition: "all 0.15s ease",
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.borderColor = "var(--brand-primary)")}
                        onMouseOut={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
                      >
                        {preset.title}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.375rem" }}>
                    Topic or Chapter *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Chemical Bonding, Shakespeare's Hamlet, Linear Equations"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.625rem 0.875rem",
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--border-default)",
                      backgroundColor: "var(--bg-app)",
                      color: "var(--text-primary)",
                      fontSize: "var(--text-sm)",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.375rem" }}>
                      Grade / Class *
                    </label>
                    <select
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.625rem 0.875rem",
                        borderRadius: "var(--radius-lg)",
                        border: "1px solid var(--border-default)",
                        backgroundColor: "var(--bg-app)",
                        color: "var(--text-primary)",
                        fontSize: "var(--text-sm)",
                        outline: "none",
                      }}
                    >
                      {["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10"].map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.375rem" }}>
                      Duration
                    </label>
                    <select
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.625rem 0.875rem",
                        borderRadius: "var(--radius-lg)",
                        border: "1px solid var(--border-default)",
                        backgroundColor: "var(--bg-app)",
                        color: "var(--text-primary)",
                        fontSize: "var(--text-sm)",
                        outline: "none",
                      }}
                    >
                      <option value="30 mins">30 mins (Quick Review)</option>
                      <option value="45 mins">45 mins (Standard Period)</option>
                      <option value="60 mins">60 mins (Hour Block)</option>
                      <option value="90 mins">90 mins (Double Period / Lab)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.375rem" }}>
                    Curriculum Standard
                  </label>
                  <select
                    value={curriculum}
                    onChange={(e) => setCurriculum(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.625rem 0.875rem",
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--border-default)",
                      backgroundColor: "var(--bg-app)",
                      color: "var(--text-primary)",
                      fontSize: "var(--text-sm)",
                      outline: "none",
                    }}
                  >
                    <option value="CBSE / General">CBSE / NCERT Core</option>
                    <option value="ICSE">ICSE Curriculum</option>
                    <option value="State Board">State Board Syllabus</option>
                  </select>
                </div>

                {/* TLM Kit Interactive Toggle */}
                <div style={{
                  padding: "0.875rem 1rem",
                  borderRadius: "var(--radius-lg)",
                  border: includeTlm ? "1.5px solid rgba(99, 102, 241, 0.45)" : "1px solid var(--border-default)",
                  background: includeTlm ? "rgba(99, 102, 241, 0.05)" : "var(--bg-app)",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  boxShadow: includeTlm ? "0 2px 10px rgba(99, 102, 241, 0.08)" : "none",
                }}>
                  <div style={{ display: "flex", gap: "0.75rem", flex: 1 }}>
                    <div style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "var(--radius-md)",
                      background: includeTlm ? "linear-gradient(135deg, #6366F1, #3B82F6)" : "var(--border-default)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#FFFFFF",
                      fontSize: "18px",
                      flexShrink: 0,
                      boxShadow: includeTlm ? "0 4px 12px rgba(99, 102, 241, 0.25)" : "none",
                      transition: "all 0.2s ease",
                    }}>
                      📦
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)" }}>
                          Include TLM Kit & Activity Guide
                        </span>
                        {includeTlm && (
                          <span style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: "999px",
                            background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
                            color: "#FFFFFF",
                            letterSpacing: "0.03em"
                          }}>
                            Recommended
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", margin: 0, lineHeight: 1.45 }}>
                        Generates low/no-cost physical manipulatives, visual organizers, digital PhET simulations, classroom deployment steps, and inclusive adaptations.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={includeTlm}
                    onClick={() => setIncludeTlm(!includeTlm)}
                    style={{
                      width: "44px",
                      height: "24px",
                      borderRadius: "999px",
                      background: includeTlm ? "var(--brand-primary)" : "var(--border-default)",
                      border: "none",
                      cursor: "pointer",
                      position: "relative",
                      flexShrink: 0,
                      marginTop: "4px",
                      transition: "background 0.2s ease",
                      padding: 0,
                    }}
                  >
                    <span style={{
                      position: "absolute",
                      top: "2px",
                      left: includeTlm ? "22px" : "2px",
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      background: "#FFFFFF",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      transition: "left 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    }} />
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: Remark Generator */}
            {activeTab === "remark" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.375rem" }}>
                      Student Name (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Rahul Sharma"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.625rem 0.875rem",
                        borderRadius: "var(--radius-lg)",
                        border: "1px solid var(--border-default)",
                        backgroundColor: "var(--bg-app)",
                        color: "var(--text-primary)",
                        fontSize: "var(--text-sm)",
                        outline: "none",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.375rem" }}>
                      Performance Band
                    </label>
                    <select
                      value={performanceLevel}
                      onChange={(e) => setPerformanceLevel(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.625rem 0.875rem",
                        borderRadius: "var(--radius-lg)",
                        border: "1px solid var(--border-default)",
                        backgroundColor: "var(--bg-app)",
                        color: "var(--text-primary)",
                        fontSize: "var(--text-sm)",
                        outline: "none",
                      }}
                    >
                      <option value="Outstanding / Top 5%">Outstanding (A+)</option>
                      <option value="Good / Consistent">Good & Consistent (A/B)</option>
                      <option value="Average / Satisfactory">Satisfactory (C)</option>
                      <option value="Needs Urgent Improvement">Needs Improvement (D/F)</option>
                    </select>
                  </div>
                </div>

                {/* Trait Chips */}
                <div>
                  <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem", display: "block" }}>
                    Quick Trait & Behavior Tags
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                    {remarkTraits.map((trait) => (
                      <button
                        key={trait}
                        type="button"
                        onClick={() => {
                          setStudentProfile((prev) => (prev ? `${prev}, ${trait}` : trait));
                        }}
                        style={{
                          fontSize: "var(--text-xs)",
                          padding: "0.3rem 0.6rem",
                          borderRadius: "var(--radius-full)",
                          border: "1px solid var(--border-default)",
                          background: "var(--bg-app)",
                          color: "var(--text-secondary)",
                          cursor: "pointer",
                          fontWeight: 500,
                          transition: "all 0.15s ease",
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.borderColor = "var(--brand-primary)")}
                        onMouseOut={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
                      >
                        + {trait}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.375rem" }}>
                    Teacher Observations & Specific Notes *
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Excellent in mental math, but needs to stay focused during collaborative activities and hand in work on time."
                    value={studentProfile}
                    onChange={(e) => setStudentProfile(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.625rem 0.875rem",
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--border-default)",
                      backgroundColor: "var(--bg-app)",
                      color: "var(--text-primary)",
                      fontSize: "var(--text-sm)",
                      outline: "none",
                      resize: "vertical",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.375rem" }}>
                    Tone of Voice
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem" }}>
                    {[
                      { id: "Encouraging", label: "Encouraging" },
                      { id: "Praising", label: "Praising" },
                      { id: "Constructive", label: "Constructive" },
                      { id: "Strict", label: "Direct & Strict" },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTone(t.id)}
                        style={{
                          padding: "0.5rem",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid",
                          borderColor: tone === t.id ? "var(--brand-primary)" : "var(--border-default)",
                          background: tone === t.id ? "var(--brand-blue-subtle)" : "var(--bg-app)",
                          color: tone === t.id ? "var(--brand-primary)" : "var(--text-secondary)",
                          fontWeight: tone === t.id ? 600 : 500,
                          fontSize: "var(--text-xs)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Parent Update Drafter */}
            {activeTab === "parent" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div>
                  <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.375rem" }}>
                    Student Name / Class *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Priya Patel, Class 9-B"
                    value={parentStudent}
                    onChange={(e) => setParentStudent(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.625rem 0.875rem",
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--border-default)",
                      backgroundColor: "var(--bg-app)",
                      color: "var(--text-primary)",
                      fontSize: "var(--text-sm)",
                      outline: "none",
                    }}
                  />
                </div>

                {/* Quick Scenario Chips */}
                <div>
                  <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem", display: "block" }}>
                    Common Communication Scenarios
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                    {parentScenarios.map((sc) => (
                      <button
                        key={sc.label}
                        type="button"
                        onClick={() => setParentContext(sc.context)}
                        style={{
                          fontSize: "var(--text-xs)",
                          padding: "0.4rem 0.75rem",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--border-default)",
                          background: parentContext === sc.context ? "var(--brand-blue-subtle)" : "var(--bg-app)",
                          color: parentContext === sc.context ? "var(--brand-primary)" : "var(--text-secondary)",
                          cursor: "pointer",
                          fontWeight: 500,
                          textAlign: "left",
                          transition: "all 0.15s ease",
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.borderColor = "var(--brand-primary)")}
                        onMouseOut={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
                      >
                        {sc.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.375rem" }}>
                    Specific Situation or Message Context *
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe the reason for contacting parents (e.g. missed homework, upcoming test, behavioral praise, medical concern)..."
                    value={parentContext}
                    onChange={(e) => setParentContext(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.625rem 0.875rem",
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--border-default)",
                      backgroundColor: "var(--bg-app)",
                      color: "var(--text-primary)",
                      fontSize: "var(--text-sm)",
                      outline: "none",
                      resize: "vertical",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.375rem" }}>
                    Target Channel Format
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
                    {[
                      { id: "whatsapp", label: "WhatsApp (Concise)" },
                      { id: "email", label: "Formal Email" },
                      { id: "sms", label: "SMS Notice" },
                    ].map((ch) => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => setUpdateChannel(ch.id as any)}
                        style={{
                          padding: "0.5rem",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid",
                          borderColor: updateChannel === ch.id ? "var(--brand-primary)" : "var(--border-default)",
                          background: updateChannel === ch.id ? "var(--brand-blue-subtle)" : "var(--bg-app)",
                          color: updateChannel === ch.id ? "var(--brand-primary)" : "var(--text-secondary)",
                          fontWeight: updateChannel === ch.id ? 600 : 500,
                          fontSize: "var(--text-xs)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {ch.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: Question Paper & Exam Blueprinter */}
            {activeTab === "paper" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {/* Preset Chips */}
                <div>
                  <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem", display: "block" }}>
                    Curriculum Exemplar Blueprints (K–10)
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.375rem" }}>
                    {paperPresets.map((preset) => (
                      <button
                        key={preset.topics}
                        type="button"
                        onClick={() => {
                          setPaperGrade(preset.grade);
                          setPaperSubject(preset.subject);
                          setPaperTotalMarks(preset.marks);
                          setPaperDuration(preset.duration);
                          setPaperTopics(preset.topics);
                        }}
                        style={{
                          fontSize: "var(--text-xs)",
                          padding: "0.45rem 0.75rem",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--border-default)",
                          background: paperTopics === preset.topics ? "var(--brand-blue-subtle)" : "var(--bg-app)",
                          color: paperTopics === preset.topics ? "var(--brand-primary)" : "var(--text-secondary)",
                          cursor: "pointer",
                          fontWeight: 500,
                          textAlign: "left",
                          transition: "all 0.15s ease",
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.borderColor = "var(--brand-primary)")}
                        onMouseOut={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
                      >
                        <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{preset.grade} • {preset.subject} ({preset.marks}M)</span> — {preset.topics}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.375rem" }}>
                      Grade (Strictly Nursery – Class 10)
                    </label>
                    <select
                      value={paperGrade}
                      onChange={(e) => setPaperGrade(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.625rem 0.875rem",
                        borderRadius: "var(--radius-lg)",
                        border: "1px solid var(--border-default)",
                        backgroundColor: "var(--bg-app)",
                        color: "var(--text-primary)",
                        fontSize: "var(--text-sm)",
                        outline: "none",
                      }}
                    >
                      {["Nursery", "Kindergarten (KG)", "Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10"].map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.375rem" }}>
                      Subject
                    </label>
                    <select
                      value={paperSubject}
                      onChange={(e) => setPaperSubject(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.625rem 0.875rem",
                        borderRadius: "var(--radius-lg)",
                        border: "1px solid var(--border-default)",
                        backgroundColor: "var(--bg-app)",
                        color: "var(--text-primary)",
                        fontSize: "var(--text-sm)",
                        outline: "none",
                      }}
                    >
                      {["Mathematics", "Science", "Social Science", "English Language & Lit", "Hindi", "Computer Science", "Environmental Studies (EVS)"].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem" }}>
                  <div>
                    <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem" }}>
                      Total Marks
                    </label>
                    <select
                      value={paperTotalMarks}
                      onChange={(e) => setPaperTotalMarks(Number(e.target.value))}
                      style={{
                        width: "100%",
                        padding: "0.5rem",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-default)",
                        backgroundColor: "var(--bg-app)",
                        color: "var(--text-primary)",
                        fontSize: "var(--text-xs)",
                        outline: "none",
                      }}
                    >
                      <option value={25}>25 M (Unit Test)</option>
                      <option value={50}>50 M (Periodic)</option>
                      <option value={80}>80 M (Board / Mock)</option>
                      <option value={100}>100 M (Annual Full)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem" }}>
                      Time Allowed
                    </label>
                    <select
                      value={paperDuration}
                      onChange={(e) => setPaperDuration(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.5rem",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-default)",
                        backgroundColor: "var(--bg-app)",
                        color: "var(--text-primary)",
                        fontSize: "var(--text-xs)",
                        outline: "none",
                      }}
                    >
                      <option value="45 Minutes">45 Mins</option>
                      <option value="1.5 Hours">1.5 Hours</option>
                      <option value="2 Hours">2 Hours</option>
                      <option value="3 Hours">3 Hours</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem" }}>
                      Difficulty Tier
                    </label>
                    <select
                      value={paperDifficulty}
                      onChange={(e) => setPaperDifficulty(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.5rem",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-default)",
                        backgroundColor: "var(--bg-app)",
                        color: "var(--text-primary)",
                        fontSize: "var(--text-xs)",
                        outline: "none",
                      }}
                    >
                      <option value="EASY">Foundational</option>
                      <option value="BALANCED">Balanced Standard</option>
                      <option value="CHALLENGING">Analytical / HOTS</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem" }}>
                      Board Standard
                    </label>
                    <select
                      value={paperBoard}
                      onChange={(e) => setPaperBoard(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.5rem",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-default)",
                        backgroundColor: "var(--bg-app)",
                        color: "var(--text-primary)",
                        fontSize: "var(--text-xs)",
                        outline: "none",
                      }}
                    >
                      <option value="CBSE">CBSE / NCERT</option>
                      <option value="State Board">State Board</option>
                      <option value="ICSE">ICSE</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.375rem" }}>
                    Syllabus Scope & Focus Chapters *
                  </label>
                  <textarea
                    rows={3}
                    placeholder="List chapters, themes, or specific competencies (e.g. Quadratic Equations, Real Numbers, Factorization, Linear Graphs)..."
                    value={paperTopics}
                    onChange={(e) => setPaperTopics(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.625rem 0.875rem",
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--border-default)",
                      backgroundColor: "var(--bg-app)",
                      color: "var(--text-primary)",
                      fontSize: "var(--text-sm)",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.625rem 0.875rem",
                  borderRadius: "var(--radius-lg)",
                  background: "var(--bg-app)",
                  border: "1px solid var(--border-default)",
                }}>
                  <input
                    type="checkbox"
                    id="includeAnswerKey"
                    checked={paperIncludeAnswerKey}
                    onChange={(e) => setPaperIncludeAnswerKey(e.target.checked)}
                    style={{ width: "16px", height: "16px", accentColor: "var(--brand-primary)", cursor: "pointer" }}
                  />
                  <label htmlFor="includeAnswerKey" style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-primary)", cursor: "pointer" }}>
                    Include Step-by-Step Marking Scheme & Evaluator Answer Key
                  </label>
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.75rem 1rem",
                borderRadius: "var(--radius-lg)",
                background: "var(--risk-high-bg)",
                color: "var(--status-danger)",
                fontSize: "var(--text-xs)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                animation: "copilotFadeIn 0.2s ease-out",
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Action Generate Button */}
            <div style={{ marginTop: "0.5rem" }}>
              <Button
                onClick={() => handleGenerate()}
                disabled={
                  isLoading ||
                  (activeTab === "lesson" && !topic) ||
                  (activeTab === "remark" && !studentProfile) ||
                  (activeTab === "parent" && (!parentStudent || !parentContext)) ||
                  (activeTab === "paper" && !paperTopics)
                }
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "var(--radius-lg)",
                  fontSize: "var(--text-sm)",
                  fontWeight: 600,
                  background: "linear-gradient(135deg, #2563EB 0%, #0891B2 100%)",
                  boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
                  transition: "all 0.2s ease",
                }}
                leftIcon={isLoading ? <Loader2 className="animate-spin" size={18} /> : <Wand2 size={18} />}
              >
                {isLoading
                  ? "Generating Copilot Intelligence..."
                  : activeTab === "lesson"
                  ? "Generate Lesson Plan"
                  : activeTab === "remark"
                  ? "Generate Remark"
                  : activeTab === "parent"
                  ? "Generate Parent Notice"
                  : "Generate Exam Paper & Blueprint"}
              </Button>
            </div>
          </div>
        )}

        {/* Right Column: AI Output Window (Seamless In-Place Expansion in Same Window) */}
        <div style={{
          background: "var(--bg-surface)",
          borderRadius: "var(--radius-2xl)",
          border: isExpanded ? "1px solid var(--brand-blue)" : "1px solid var(--border-default)",
          boxShadow: isExpanded ? "var(--shadow-xl), 0 0 24px rgba(37, 99, 235, 0.12)" : "var(--shadow-card)",
          display: "flex",
          flexDirection: "column",
          minHeight: isExpanded ? "700px" : "560px",
          height: "100%",
          position: "relative",
          overflow: "hidden",
          gridColumn: isExpanded ? "1 / -1" : "auto",
          transition: "all 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
          animation: isExpanded ? "copilotInPlaceExpand 0.35s cubic-bezier(0.16, 1, 0.3, 1)" : "none",
        }}>
          {/* Top shimmer progress line when loading */}
          {isLoading && (
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", overflow: "hidden", background: "rgba(37, 99, 235, 0.15)", zIndex: 5 }}>
              <div style={{ width: "50%", height: "100%", background: "linear-gradient(90deg, transparent, #2563EB, #0891B2, transparent)", animation: "copilotShimmer 1.5s infinite" }} />
            </div>
          )}

          {/* Output Card Header */}
          <div style={{
            padding: "1rem 1.5rem",
            borderBottom: "1px solid var(--border-default)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--bg-surface-hover)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap" }}>
              <div style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: result ? "var(--status-success)" : isLoading ? "var(--brand-primary)" : "var(--text-tertiary)",
                boxShadow: result ? "0 0 8px var(--status-success)" : "none",
                transition: "all 0.3s ease",
              }} />
              <h3 style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)" }}>
                AI Generated Output
              </h3>

              {/* In-Place Full Width Badge when expanded */}
              {isExpanded && (
                <span style={{
                  background: "var(--brand-blue-subtle)",
                  color: "var(--brand-primary)",
                  fontSize: "var(--text-xs)",
                  fontWeight: 700,
                  padding: "0.2rem 0.65rem",
                  borderRadius: "var(--radius-full)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  animation: "copilotFadeIn 0.2s ease-out",
                }}>
                  <Maximize2 size={11} />
                  Full Width Canvas
                </span>
              )}

              {result && (
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                  ({wordCount} words · {charCount} chars)
                </span>
              )}
            </div>

            {/* Quick Output Actions & Modern Expand Icon Button */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {result && (
                <>
                  {activeTab === "lesson" && (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowLessonPlanPrintModal(true)}
                        title="Print / Export Official Lesson Plan & TLM Kit"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.375rem",
                          padding: "0.375rem 0.625rem",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid rgba(99, 102, 241, 0.4)",
                          background: "rgba(99, 102, 241, 0.15)",
                          color: "var(--brand-primary)",
                          fontSize: "var(--text-xs)",
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.background = "rgba(99, 102, 241, 0.25)")}
                        onMouseOut={(e) => (e.currentTarget.style.background = "rgba(99, 102, 241, 0.15)")}
                      >
                        <Printer size={14} />
                        Print / Export Plan
                      </button>
                      <button
                        type="button"
                        onClick={copyStudentHandout}
                        title="Copy Student Handout & Exit Slip Only"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.375rem",
                          padding: "0.375rem 0.625rem",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--border-default)",
                          background: copiedStudentHandout ? "rgba(16, 185, 129, 0.15)" : "var(--bg-surface)",
                          color: copiedStudentHandout ? "#10B981" : "var(--text-secondary)",
                          fontSize: "var(--text-xs)",
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.borderColor = "var(--brand-primary)")}
                        onMouseOut={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
                      >
                        {copiedStudentHandout ? <Check size={14} /> : <FileText size={14} />}
                        {copiedStudentHandout ? "Copied Handout!" : "Copy Handout"}
                      </button>
                    </>
                  )}
                  {activeTab === "paper" && (
                    <button
                      type="button"
                      onClick={() => setShowPrintModal(true)}
                      title="Print Official Exam Sheet (A4)"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        padding: "0.375rem 0.625rem",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid rgba(99, 102, 241, 0.4)",
                        background: "rgba(99, 102, 241, 0.15)",
                        color: "var(--brand-primary)",
                        fontSize: "var(--text-xs)",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.background = "rgba(99, 102, 241, 0.25)")}
                      onMouseOut={(e) => (e.currentTarget.style.background = "rgba(99, 102, 241, 0.15)")}
                    >
                      <Printer size={14} />
                      Print Exam Sheet
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={downloadMarkdown}
                    title="Download as Markdown"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.375rem",
                      padding: "0.375rem 0.625rem",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-default)",
                      background: "var(--bg-surface)",
                      color: "var(--text-secondary)",
                      fontSize: "var(--text-xs)",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.borderColor = "var(--brand-primary)")}
                    onMouseOut={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
                  >
                    <Download size={14} />
                    Export .md
                  </button>
                  <button
                    type="button"
                    onClick={copyToClipboard}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.375rem",
                      padding: "0.375rem 0.75rem",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--brand-primary)",
                      background: copied ? "var(--status-success)" : "var(--brand-primary)",
                      color: "#FFFFFF",
                      fontSize: "var(--text-xs)",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </>
              )}

              {/* Modern Expand Icon Button with Hover Tooltip (No Literal Text) */}
              <div className="copilot-tooltip-wrapper">
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  aria-label={isExpanded ? "Collapse view" : "Expand view"}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "34px",
                    height: "34px",
                    borderRadius: "var(--radius-lg)",
                    border: isExpanded ? "1px solid var(--brand-primary)" : "1px solid var(--border-default)",
                    background: isExpanded ? "var(--brand-blue-subtle)" : "var(--bg-surface)",
                    color: isExpanded ? "var(--brand-primary)" : "var(--text-secondary)",
                    cursor: "pointer",
                    transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = "var(--brand-primary)";
                    e.currentTarget.style.color = "var(--brand-primary)";
                    e.currentTarget.style.transform = "scale(1.06)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = isExpanded ? "var(--brand-primary)" : "var(--border-default)";
                    e.currentTarget.style.color = isExpanded ? "var(--brand-primary)" : "var(--text-secondary)";
                    e.currentTarget.style.transform = "none";
                  }}
                >
                  {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <div className="copilot-tooltip-badge">
                  {isExpanded ? "Collapse view" : "Expand view"}
                </div>
              </div>
            </div>
          </div>

          {/* Content Body */}
          <div style={{
            flex: 1,
            padding: isExpanded ? "2rem 2.5rem" : "1.5rem",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            transition: "padding 0.3s ease",
          }}>
            {isLoading ? (
              <div style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "1rem",
                color: "var(--text-secondary)",
                animation: "copilotFadeIn 0.3s ease-out",
              }}>
                <div style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: "var(--brand-blue-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Loader2 size={32} className="animate-spin" style={{ color: "var(--brand-primary)" }} />
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "var(--text-sm)" }}>
                    Crafting {activeTab === "lesson" ? "Lesson Plan" : activeTab === "remark" ? "Personalized Remark" : "Parent Communication"}...
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: "0.25rem" }}>
                    Applying educational taxonomy and curriculum guidelines
                  </div>
                </div>
              </div>
            ) : cleanResult ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", animation: "copilotFadeIn 0.35s ease-out" }}>
                <div className="prose dark:prose-invert" style={{
                  maxWidth: "100%",
                  fontSize: isExpanded ? "var(--text-base)" : "var(--text-sm)",
                  lineHeight: isExpanded ? 1.8 : 1.7,
                  color: "var(--text-primary)",
                  transition: "font-size 0.2s ease, line-height 0.2s ease",
                }}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={markdownComponents}
                  >
                    {cleanResult}
                  </ReactMarkdown>
                </div>

                {/* Quick AI Refine Prompts */}
                <div style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "var(--radius-xl)",
                  background: "var(--bg-app)",
                  border: "1px solid var(--border-default)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                  marginTop: "0.5rem",
                }}>
                  <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Quick Refine
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                    <button
                      type="button"
                      onClick={() => handleGenerate(`Take the previous plan on "${topic}" and make it more concise with a focus on fast-paced interactive activities.`)}
                      style={{
                        fontSize: "var(--text-xs)",
                        padding: "0.3rem 0.6rem",
                        borderRadius: "var(--radius-full)",
                        border: "1px solid var(--border-default)",
                        background: "var(--bg-surface)",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.borderColor = "var(--brand-primary)"; }}
                      onMouseOut={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = "var(--border-default)"; }}
                    >
                      ⚡ Make More Concise
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGenerate(`Expand the previous plan on "${topic}" with 5 challenging inquiry questions and a grading rubric.`)}
                      style={{
                        fontSize: "var(--text-xs)",
                        padding: "0.3rem 0.6rem",
                        borderRadius: "var(--radius-full)",
                        border: "1px solid var(--border-default)",
                        background: "var(--bg-surface)",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.borderColor = "var(--brand-primary)"; }}
                      onMouseOut={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = "var(--border-default)"; }}
                    >
                      📝 Add 5 Quiz Questions & Rubric
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGenerate(`Rewrite the previous response on "${topic}" with differentiated instruction notes for diverse learning speeds.`)}
                      style={{
                        fontSize: "var(--text-xs)",
                        padding: "0.3rem 0.6rem",
                        borderRadius: "var(--radius-full)",
                        border: "1px solid var(--border-default)",
                        background: "var(--bg-surface)",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.borderColor = "var(--brand-primary)"; }}
                      onMouseOut={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = "var(--border-default)"; }}
                    >
                      🎯 Differentiated Learning Support
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "1rem",
                color: "var(--text-tertiary)",
                textAlign: "center",
                padding: "2rem",
              }}>
                <div style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  background: "var(--bg-app)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--brand-primary)",
                  border: "1px dashed var(--border-default)",
                }}>
                  <Sparkles size={28} />
                </div>
                <div>
                  <h4 style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
                    Your Generated Draft Appears Here
                  </h4>
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", maxWidth: "340px", lineHeight: 1.5 }}>
                    Select your parameters on the left and click <strong>Generate Draft</strong> to create curriculum-ready lesson plans, student remarks, or parent communications.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Printable Exam Sheet Modal */}
      <PrintableQuestionPaperModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        paperContent={cleanResult}
        grade={paperGrade}
        subject={paperSubject}
        totalMarks={Number(paperTotalMarks)}
        duration={paperDuration}
        schoolName={schoolName}
        board={paperBoard}
      />

      {/* Printable Lesson Plan & TLM Kit Modal */}
      <PrintableLessonPlanModal
        isOpen={showLessonPlanPrintModal}
        onClose={() => setShowLessonPlanPrintModal(false)}
        lessonPlanContent={cleanResult}
        topic={topic}
        grade={grade}
        subject={topic}
        duration={duration}
        curriculum={curriculum}
        schoolName={schoolName}
      />
    </div>
  );
}
