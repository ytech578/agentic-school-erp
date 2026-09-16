"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send, Sparkles, Globe, MapPin, Calendar, CheckCircle2,
  Phone, User, Award, Shield, ArrowRight, RefreshCw, MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { apiClient } from "@/lib/axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  id: string;
  sender: "user" | "concierge";
  text: string;
  timestamp: string;
  detectedIntent?: string;
  capturedLead?: {
    enquiryNo: string;
    parentName: string;
    studentName?: string;
    phone: string;
    classApplied?: string;
  };
}

const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "hi", label: "हिन्दी (Hindi)", flag: "🇮🇳" },
  { code: "te", label: "తెలుగు (Telugu)", flag: "🇮🇳" },
  { code: "ta", label: "தமிழ் (Tamil)", flag: "🇮🇳" },
  { code: "mr", label: "मराठी (Marathi)", flag: "🇮🇳" },
];

const QUICK_PROMPTS = [
  { label: "Age Criteria for Nursery & Class 1", text: "What is the age criteria for Nursery and Class 1 admissions under NEP 2020 guidelines?" },
  { label: "Book a Saturday Campus Tour", text: "I would like to schedule an in-person campus tour this Saturday morning." },
  { label: "CBSE Curriculum & Co-Curriculars", text: "Can you tell me about the CBSE academic curriculum, sports, and laboratory facilities for Grades 1 to 10?" },
  { label: "Fee Structure & Installment Plans", text: "What is the fee breakdown and quarterly payment installment schedule for primary and middle school?" },
  { label: "Bus Routes & Child Safety", text: "What are the school bus transportation routes, GPS tracking, and campus security measures?" },
];

const GRADE_OPTIONS = [
  "Nursery", "LKG", "UKG",
  "Class 1", "Class 2", "Class 3", "Class 4", "Class 5",
  "Class 6", "Class 7", "Class 8", "Class 9", "Class 10",
];

export default function AdmissionsHelpdeskWidget({
  onEnquiryCreated,
  isEmbedded = true,
}: {
  onEnquiryCreated?: () => void;
  isEmbedded?: boolean;
}) {
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [sessionId] = useState(() => `session_adm_${Math.random().toString(36).substring(2, 9)}`);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showLeadDrawer, setShowLeadDrawer] = useState(false);

  // Prospective Parent Lead Info
  const [parentName, setParentName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [classApplied, setClassApplied] = useState("Class 1");
  const [studentName, setStudentName] = useState("");

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-1",
      sender: "concierge",
      text: `👋 **Namaste & Welcome to our Admissions Portal!**\n\nI am your 24/7 AI Campus Concierge. I can assist you with:\n- **Nursery to Grade 10 Admissions & NEP 2020 age criteria**\n- **Curriculum, co-curriculars, and STEM / Sports facilities**\n- **Fee schedules and transport routes**\n- **Scheduling an in-person campus tour**\n\nFeel free to ask your questions in **English, हिन्दी, తెలుగు, தமிழ், or मराठी**!`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (msgText?: string) => {
    const textToSend = msgText || inputMessage;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      sender: "user",
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setIsLoading(true);

    try {
      // Attempt authenticated endpoint first, fallback to public endpoint
      let res;
      const payload = {
        message: textToSend.trim(),
        language: selectedLanguage,
        sessionId,
        parentName: parentName.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        classApplied: classApplied || undefined,
        studentName: studentName.trim() || undefined,
      };

      try {
        res = await apiClient.post("/ai/helpdesk/chat", payload);
      } catch (authErr) {
        // Fallback to public endpoint
        res = await apiClient.post("/public/helpdesk/chat", payload);
      }

      const data = res.data?.data || res.data;

      const botMsg: Message = {
        id: `bot_${Date.now()}`,
        sender: "concierge",
        text: data.reply || "Thank you for reaching out. Our admissions counselor will contact you shortly.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        detectedIntent: data.detectedIntent,
        capturedLead: data.capturedLead,
      };

      setMessages((prev) => [...prev, botMsg]);

      if (data.capturedLead && onEnquiryCreated) {
        onEnquiryCreated();
      }
    } catch (err: any) {
      console.error("Helpdesk chat error:", err);
      const fallbackMsg: Message = {
        id: `bot_err_${Date.now()}`,
        sender: "concierge",
        text: "Thank you for your inquiry. Admissions for Nursery through Grade 10 are currently open. Please call our admissions desk at +91 98765 43210 or share your contact number to schedule an appointment.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSession = () => {
    setMessages([
      {
        id: `welcome_${Date.now()}`,
        sender: "concierge",
        text: `👋 **Welcome back!** Conversation reset. How may I assist you with admissions today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-surface)",
        borderRadius: "var(--radius-2xl)",
        border: "1px solid var(--border-default)",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)",
        height: isEmbedded ? "680px" : "100%",
        overflow: "hidden",
      }}
    >
      {/* ─── Top Concierge Header ─────────────────────────────────────────── */}
      <div
        style={{
          padding: "1rem 1.5rem",
          background: "linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(124, 58, 237, 0.08) 100%)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              boxShadow: "0 4px 12px rgba(79, 70, 229, 0.35)",
            }}
          >
            <Sparkles size={20} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <h3 style={{ fontSize: "var(--text-base)", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
                24/7 Admissions Concierge & Campus Guide
              </h3>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  fontSize: "10px",
                  fontWeight: 700,
                  padding: "0.15rem 0.5rem",
                  borderRadius: "var(--radius-full)",
                  background: "rgba(16, 185, 129, 0.15)",
                  color: "var(--status-success)",
                }}
              >
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10B981" }} />
                Online
              </span>
            </div>
            <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: "0.15rem 0 0" }}>
              Strictly Nursery to Grade 10 • Automatic Enquiry Lead Registration
            </p>
          </div>
        </div>

        {/* Right Controls: Language Selector & Tour CTA */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "var(--bg-app)", padding: "0.3rem 0.6rem", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)" }}>
            <Globe size={14} color="#6366F1" />
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-primary)",
                cursor: "pointer",
                outline: "none",
              }}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.label}
                </option>
              ))}
            </select>
          </div>

          <Button
            size="sm"
            variant={showLeadDrawer ? "primary" : "outline"}
            onClick={() => setShowLeadDrawer(!showLeadDrawer)}
            style={{ fontSize: "11px", display: "flex", alignItems: "center", gap: "0.35rem" }}
          >
            <User size={13} />
            {showLeadDrawer ? "Hide Lead Info" : "Parent Details"}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleResetSession}
            title="Reset Chat"
            style={{ padding: "0.4rem", color: "var(--text-secondary)" }}
          >
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      {/* ─── Prospective Parent Details Drawer (Optional Capture) ──────────── */}
      {showLeadDrawer && (
        <div
          style={{
            padding: "1rem 1.5rem",
            background: "rgba(99, 102, 241, 0.04)",
            borderBottom: "1px solid var(--border-subtle)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "0.75rem",
            alignItems: "flex-end",
          }}
        >
          <div>
            <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "0.25rem", textTransform: "uppercase" }}>Parent Name</label>
            <input
              type="text"
              placeholder="e.g. Priya Sharma"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              style={{ width: "100%", padding: "0.4rem 0.6rem", fontSize: "12px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-surface)" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "0.25rem", textTransform: "uppercase" }}>Phone (10-digits) *</label>
            <input
              type="tel"
              placeholder="e.g. 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ width: "100%", padding: "0.4rem 0.6rem", fontSize: "12px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-surface)" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "0.25rem", textTransform: "uppercase" }}>Child Name</label>
            <input
              type="text"
              placeholder="e.g. Aarav"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              style={{ width: "100%", padding: "0.4rem 0.6rem", fontSize: "12px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-surface)" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "0.25rem", textTransform: "uppercase" }}>Grade Applied (K–10)</label>
            <select
              value={classApplied}
              onChange={(e) => setClassApplied(e.target.value)}
              style={{ width: "100%", padding: "0.4rem 0.6rem", fontSize: "12px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-surface)" }}
            >
              {GRADE_OPTIONS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ─── Chat Messages Container ───────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1.25rem 1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        {messages.map((m) => {
          const isUser = m.sender === "user";
          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                justifyContent: isUser ? "flex-end" : "flex-start",
                gap: "0.6rem",
              }}
            >
              {!isUser && (
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#FFFFFF",
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                >
                  <Sparkles size={16} />
                </div>
              )}

              <div
                style={{
                  maxWidth: "80%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isUser ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    padding: "0.85rem 1.1rem",
                    borderRadius: isUser ? "1.25rem 1.25rem 0.25rem 1.25rem" : "1.25rem 1.25rem 1.25rem 0.25rem",
                    background: isUser
                      ? "linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)"
                      : "var(--bg-app)",
                    color: isUser ? "#FFFFFF" : "var(--text-primary)",
                    border: isUser ? "none" : "1px solid var(--border-default)",
                    fontSize: "var(--text-sm)",
                    lineHeight: 1.6,
                    boxShadow: isUser ? "0 4px 12px rgba(79, 70, 229, 0.25)" : "none",
                  }}
                >
                  {isUser ? (
                    <span>{m.text}</span>
                  ) : (
                    <div className="prose prose-sm dark:prose-invert" style={{ maxWidth: "100%" }}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                    </div>
                  )}
                </div>

                {/* Lead Captured Confirmation Card */}
                {m.capturedLead && (
                  <div
                    style={{
                      marginTop: "0.6rem",
                      padding: "0.85rem 1rem",
                      borderRadius: "var(--radius-lg)",
                      background: "rgba(16, 185, 129, 0.08)",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      maxWidth: "100%",
                    }}
                  >
                    <CheckCircle2 size={24} color="#10B981" style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 800, color: "var(--status-success)" }}>
                        Enquiry Recorded: #{m.capturedLead.enquiryNo}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "0.15rem" }}>
                        Parent: <b>{m.capturedLead.parentName}</b> • Phone: <b>{m.capturedLead.phone}</b>
                        {m.capturedLead.classApplied && <> • Class: <b>{m.capturedLead.classApplied}</b></>}
                      </div>
                    </div>
                  </div>
                )}

                <span style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "0.25rem" }}>
                  {m.timestamp}
                </span>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
              }}
            >
              <Sparkles size={16} />
            </div>
            <div
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "1.25rem 1.25rem 1.25rem 0.25rem",
                background: "var(--bg-app)",
                border: "1px solid var(--border-default)",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "12px",
                color: "var(--text-secondary)",
              }}
            >
              <RefreshCw size={13} className="animate-spin" />
              <span>Concierge is typing...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ─── Quick Prompt Chips ────────────────────────────────────────────── */}
      <div
        style={{
          padding: "0.5rem 1.5rem",
          background: "var(--bg-app)",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          overflowX: "auto",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
          Suggested:
        </span>
        {QUICK_PROMPTS.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(p.text)}
            style={{
              padding: "0.3rem 0.65rem",
              borderRadius: "var(--radius-full)",
              fontSize: "11px",
              fontWeight: 600,
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-default)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ─── Input Bar ────────────────────────────────────────────────────── */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        style={{
          padding: "1rem 1.5rem",
          background: "var(--bg-surface)",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
        }}
      >
        <input
          type="text"
          placeholder={`Ask anything about admissions, tours, or curriculum in ${SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage)?.label}...`}
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          disabled={isLoading}
          style={{
            flex: 1,
            padding: "0.75rem 1rem",
            borderRadius: "var(--radius-xl)",
            border: "1px solid var(--border-default)",
            background: "var(--bg-app)",
            color: "var(--text-primary)",
            fontSize: "var(--text-sm)",
            outline: "none",
          }}
        />
        <Button
          type="submit"
          variant="primary"
          disabled={!inputMessage.trim() || isLoading}
          style={{
            borderRadius: "var(--radius-xl)",
            padding: "0.75rem 1.25rem",
            background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
            color: "#FFFFFF",
            border: "none",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          <Send size={15} />
          <span>Send</span>
        </Button>
      </form>
    </div>
  );
}
