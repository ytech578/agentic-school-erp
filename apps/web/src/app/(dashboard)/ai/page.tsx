"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PendingAction, useAIStore } from "@/store/ai.store";
import {
  Sparkles,
  Send,
  Bot,
  Loader2,
  MessageSquare,
  Plus,
  Trash2,
  PanelLeft,
  CheckCircle,
  XCircle,
  Zap,
  Paperclip,
  Mic,
  ArrowUp,
} from "lucide-react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { apiClient } from "@/lib/axios";
import { useAuthStore } from "@/store/auth.store";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import {
  FileAttachment,
  FileAttachmentChips,
  VoiceWaveformBar,
  fileToAttachment,
} from "@/components/ai/FileAttachmentChips";

interface ConversationItem {
  id: string;
  title?: string;
  createdAt?: string;
}

export default function AIFullPage() {
  const {
    messages,
    sendMessage,
    isLoading,
    conversationId,
    clearConversation,
    loadConversation,
    executeAction,
  } = useAIStore();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [history, setHistory] = useState<ConversationItem[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const [dismissedActions, setDismissedActions] = useState<Record<number, boolean>>({});

  // Multimodal attachments and voice recognition state
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialInputRef = useRef("");

  const {
    isListening,
    isSpeaking,
    audioLevel,
    mediaStream,
    toggleListening,
    stopListening,
    interimTranscript,
    isSupported: isSpeechSupported,
  } = useSpeechRecognition({
    onStart: () => {
      initialInputRef.current = input;
    },
    onTranscriptChange: (spokenText) => {
      const base = initialInputRef.current.trim();
      const combined = base ? `${base} ${spokenText}` : spokenText;
      setInput(combined);
    },
    onError: (errMsg) => {
      toast.error(errMsg);
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (attachments.length + files.length > 5) {
      toast.error("You can attach a maximum of 5 files at a time.");
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`"${file.name}" exceeds the 10MB limit.`);
        continue;
      }
      try {
        const att = await fileToAttachment(file);
        setAttachments((prev) => [...prev, att]);
      } catch {
        toast.error(`Could not process "${file.name}"`);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const fetchHistory = useCallback(async () => {
    if (!useAuthStore.getState().isAuthenticated) return;
    try {
      const res = await apiClient.get("/ai/conversations");
      setHistory(res.data.data || res.data || []);
    } catch {}
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let isMounted = true;
    apiClient
      .get("/ai/conversations")
      .then((res) => {
        if (isMounted) {
          setHistory(res.data.data || res.data || []);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [conversationId, isAuthenticated]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = async (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    if ((!input.trim() && attachments.length === 0) || isLoading) return;
    if (isListening) stopListening();

    const text = input.trim() || (attachments.length > 0 ? "Analyzing attached file(s)..." : "");
    const currentAttachments = [...attachments];
    setInput("");
    setAttachments([]);
    await sendMessage(text, currentAttachments);
    fetchHistory();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiClient.delete(`/ai/conversations/${id}`);
      if (conversationId === id) clearConversation();
      fetchHistory();
    } catch {}
  };

  const handleConfirmAction = async (action: PendingAction, msgIndex: number) => {
    if (!action.actionId) {
      toast.error("Invalid action ID.");
      return;
    }
    setExecutingAction(`${msgIndex}`);
    try {
      const result = await executeAction(action.actionId);
      if (result.success) {
        toast.success(result.message);
        setDismissedActions((prev) => ({ ...prev, [msgIndex]: true }));
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Failed to execute action.");
    } finally {
      setExecutingAction(null);
    }
  };

  const handleDismissAction = (msgIndex: number) => {
    setDismissedActions((prev) => ({ ...prev, [msgIndex]: true }));
  };

  const chips = [
    "Who are the top students by attendance?",
    "Approve the pending leave request",
    "Send an announcement about tomorrow holiday",
    "Create an assignment for Class 10 on Photosynthesis",
  ];

  return (
    <div style={{ display: "flex", height: "calc(100vh - 90px)", gap: "1.5rem" }}>
      {/* Sidebar History */}
      <div
        style={{
          width: isSidebarOpen ? "280px" : "0px",
          opacity: isSidebarOpen ? 1 : 0,
          background: "var(--bg-surface)",
          borderRadius: "var(--radius-lg)",
          border: isSidebarOpen ? "1px solid var(--border-default)" : "none",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          flexShrink: 0,
        }}
      >
        <div style={{ padding: "1.5rem", borderBottom: "1px solid var(--border-default)", minWidth: "280px" }}>
          <Button onClick={clearConversation} style={{ width: "100%", justifyContent: "center" }}>
            <Plus size={16} style={{ marginRight: "0.5rem" }} /> New Chat
          </Button>
        </div>
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            minWidth: "280px",
          }}
        >
          {history.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--text-tertiary)", fontSize: "var(--text-sm)", marginTop: "2rem" }}>
              No previous chats
            </p>
          ) : (
            history.map((conv) => (
              <div
                key={conv.id}
                onClick={() => {
                  loadConversation(conv.id);
                  if (typeof window !== "undefined" && window.innerWidth < 768) {
                    setIsSidebarOpen(false);
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.75rem 1rem",
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer",
                  background: conversationId === conv.id ? "var(--bg-active)" : "transparent",
                  color: conversationId === conv.id ? "var(--text-primary)" : "var(--text-secondary)",
                  transition: "background var(--duration-fast)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", overflow: "hidden" }}>
                  <MessageSquare size={16} />
                  <span
                    style={{
                      fontSize: "var(--text-sm)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {conv.title || "New Chat"}
                  </span>
                </div>
                <button
                  onClick={(e) => handleDelete(conv.id, e)}
                  style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div
        style={{
          flex: 1,
          background: "var(--bg-surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-default)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.5rem",
            borderBottom: "1px solid var(--border-default)",
            display: "flex",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            style={{ padding: "0.5rem", color: "var(--text-secondary)" }}
          >
            <PanelLeft size={20} />
          </Button>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "var(--radius-md)",
              background: "linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-tertiary) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
            }}
          >
            <Sparkles size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-bold)" }}>Agentic AI Assistant</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
              Powered by Google Gemini - Can take real actions
            </p>
          </div>
        </div>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "2rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
          }}
        >
          {messages.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: "2rem",
                textAlign: "center",
                maxWidth: "800px",
                margin: "0 auto",
              }}
            >
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  background: "var(--brand-primary-light)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Sparkles size={40} color="var(--brand-primary)" />
              </div>
              <div>
                <h3 style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)", marginBottom: "0.5rem" }}>
                  How can I help you today?
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-base)" }}>
                  I can navigate the system, analyze data, and take real actions like approving leaves, creating
                  assignments, and sending announcements.
                </p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", width: "100%" }}>
                {chips.map((c) => (
                  <button
                    key={c}
                    onClick={() => sendMessage(c)}
                    style={{
                      padding: "1rem",
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-default)",
                      borderRadius: "var(--radius-lg)",
                      fontSize: "var(--text-sm)",
                      color: "var(--text-primary)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.2s",
                      boxShadow: "var(--shadow-sm)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--brand-primary)";
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border-default)";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: "1rem",
                  alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "90%",
                  flexDirection: "column",
                }}
              >
                <div style={{ display: "flex", gap: "1rem", alignSelf: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  {msg.role === "assistant" && (
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        background: "var(--brand-primary-light)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Bot size={20} color="var(--brand-primary)" />
                    </div>
                  )}
                  <div
                    style={{
                      background: msg.role === "user" ? "var(--brand-primary)" : "var(--bg-elevated)",
                      color: msg.role === "user" ? "white" : "var(--text-primary)",
                      padding: "1.25rem",
                      borderRadius: "var(--radius-xl)",
                      border: msg.role === "assistant" ? "1px solid var(--border-default)" : "none",
                      fontSize: "var(--text-base)",
                      lineHeight: 1.6,
                      borderTopRightRadius: msg.role === "user" ? "4px" : "var(--radius-xl)",
                      borderTopLeftRadius: msg.role === "assistant" ? "4px" : "var(--radius-xl)",
                      boxShadow: "var(--shadow-md)",
                    }}
                  >
                    {msg.role === "user" ? (
                      <div>
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.5rem" }}>
                            {msg.attachments.map((att, attIdx) => (
                              <div
                                key={attIdx}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.35rem",
                                  padding: "0.25rem 0.5rem",
                                  background: "rgba(255, 255, 255, 0.2)",
                                  borderRadius: "var(--radius-md)",
                                  fontSize: "11px",
                                  color: "#FFFFFF",
                                  fontWeight: 500,
                                }}
                              >
                                {att.previewUrl ? (
                                  <img
                                    src={att.previewUrl}
                                    alt={att.name}
                                    style={{ width: "16px", height: "16px", borderRadius: "2px", objectFit: "cover" }}
                                  />
                                ) : (
                                  <span>📎</span>
                                )}
                                <span style={{ maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {att.name}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div>{msg.content}</div>
                      </div>
                    ) : (
                      <div className="prose dark:prose-invert" style={{ margin: 0, maxWidth: "none" }}>
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                    {msg.role === "assistant" && msg.content.includes("(/") && (
                      <div style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                        {Array.from(msg.content.matchAll(/\[(.*?)\]\((.*?)\)/g)).map((match, idx) => (
                          <button
                            key={idx}
                            onClick={() => router.push(match[2])}
                            style={{
                              background: "var(--brand-primary)",
                              color: "white",
                              border: "none",
                              padding: "0.375rem 1rem",
                              borderRadius: "var(--radius-full)",
                              fontSize: "var(--text-sm)",
                              cursor: "pointer",
                              fontWeight: "var(--font-medium)",
                            }}
                          >
                            Go to {match[1]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Confirmation Card */}
                {msg.role === "assistant" && msg.pendingAction && !dismissedActions[i] && (
                  <div
                    style={{
                      marginLeft: "52px",
                      background: "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.08) 100%)",
                      border: "1px solid rgba(99,102,241,0.3)",
                      borderRadius: "var(--radius-lg)",
                      padding: "1rem 1.25rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "1rem",
                      animation: "slideInUp 0.3s ease-out",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <Zap size={20} color="var(--brand-primary)" />
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                          <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                            Proposed Action
                          </p>
                          {msg.pendingAction.riskLevel && (
                            <span
                              style={{
                                fontSize: "10px",
                                padding: "1px 6px",
                                borderRadius: "4px",
                                fontWeight: 600,
                                background:
                                  msg.pendingAction.riskLevel === "HIGH"
                                    ? "rgba(239, 68, 68, 0.15)"
                                    : msg.pendingAction.riskLevel === "MEDIUM"
                                    ? "rgba(245, 158, 11, 0.15)"
                                    : "rgba(16, 185, 129, 0.15)",
                                color:
                                  msg.pendingAction.riskLevel === "HIGH"
                                    ? "#ef4444"
                                    : msg.pendingAction.riskLevel === "MEDIUM"
                                    ? "#f59e0b"
                                    : "#10b981",
                              }}
                            >
                              {msg.pendingAction.riskLevel} RISK
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-semibold)", color: "var(--text-primary)" }}>
                          {msg.pendingAction.label}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                      <button
                        onClick={() => handleConfirmAction(msg.pendingAction!, i)}
                        disabled={executingAction === `${i}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.375rem",
                          padding: "0.5rem 1rem",
                          borderRadius: "var(--radius-md)",
                          background: "var(--brand-primary)",
                          color: "white",
                          border: "none",
                          fontSize: "var(--text-sm)",
                          fontWeight: "var(--font-medium)",
                          cursor: "pointer",
                        }}
                      >
                        {executingAction === `${i}` ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <CheckCircle size={14} />
                        )}
                        Confirm
                      </button>
                      <button
                        onClick={() => handleDismissAction(i)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.375rem",
                          padding: "0.5rem 1rem",
                          borderRadius: "var(--radius-md)",
                          background: "var(--bg-surface)",
                          color: "var(--text-secondary)",
                          border: "1px solid var(--border-default)",
                          fontSize: "var(--text-sm)",
                          cursor: "pointer",
                        }}
                      >
                        <XCircle size={14} /> Dismiss
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
          {isLoading && (
            <div style={{ display: "flex", gap: "1rem", alignSelf: "flex-start", maxWidth: "80%" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "var(--brand-primary-light)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Bot size={20} color="var(--brand-primary)" />
              </div>
              <div
                style={{
                  background: "var(--bg-elevated)",
                  padding: "1.25rem",
                  borderRadius: "var(--radius-xl)",
                  border: "1px solid var(--border-default)",
                  display: "flex",
                  gap: "0.5rem",
                }}
              >
                <span className="typing-dot-lg" style={{ animationDelay: "0s" }} />
                <span className="typing-dot-lg" style={{ animationDelay: "0.2s" }} />
                <span className="typing-dot-lg" style={{ animationDelay: "0.4s" }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{ padding: "1.25rem 1.5rem", borderTop: "1px solid var(--border-default)", background: "var(--bg-elevated)" }}>
          <div style={{ maxWidth: "800px", margin: "0 auto" }}>
            {/* Active Attachment Chips */}
            <FileAttachmentChips
              attachments={attachments}
              onRemoveAttachment={removeAttachment}
            />

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              id="ai-file-upload-input"
              name="ai-file-upload-input"
              multiple
              accept="image/*,application/pdf,.csv,.xlsx,.xls,.docx,.txt"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />

            {/* Listening Status Subtitle Header (Above pill when listening) */}
            {isListening && (
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 0.5rem 0.35rem 0.5rem",
                fontSize: "var(--text-xs)",
                color: isSpeaking ? "var(--brand-primary)" : "var(--text-secondary)",
                fontWeight: 500,
                transition: "color 0.2s ease",
              }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    background: isSpeaking ? "var(--brand-primary)" : "#10B981",
                    boxShadow: isSpeaking ? "0 0 8px var(--brand-primary)" : "none",
                    display: "inline-block",
                  }} />
                  {isSpeaking ? "Listening to your voice..." : "Listening... Speak your question or command"}
                </span>
                {interimTranscript && (
                  <span style={{ color: "var(--text-tertiary)", fontStyle: "italic", maxWidth: "320px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    &ldquo;{interimTranscript}&rdquo;
                  </span>
                )}
              </div>
            )}

            {/* Main Input Row - Constant Flex Geometry (Never jumps in length!) */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.25rem" }}>
              {/* Search bar pill */}
              <div style={{
                flex: 1,
                height: "54px",
                display: "flex",
                alignItems: "center",
                padding: isListening ? "0 0.625rem" : "0.35rem 0.5rem 0.35rem 1.25rem",
                borderRadius: "var(--radius-full)",
                border: isListening ? "1.5px solid var(--brand-primary)" : "1px solid var(--border-default)",
                background: "var(--bg-input)",
                boxShadow: isListening
                  ? "0 0 0 3px rgba(37, 99, 235, 0.12), inset 0 1px 2px rgba(0,0,0,0.02)"
                  : "inset 0 2px 4px rgba(0,0,0,0.02)",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                boxSizing: "border-box",
                overflow: "hidden",
              }}>
                {isListening ? (
                  <VoiceWaveformBar
                    isListening={isListening}
                    isSpeaking={isSpeaking}
                    audioLevel={audioLevel}
                    mediaStream={mediaStream}
                    onStop={stopListening}
                    onAttachClick={() => fileInputRef.current?.click()}
                  />
                ) : (
                  <>
                    <input
                      id="ai-chat-prompt-input"
                      name="ai-chat-prompt-input"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Ask or command: e.g. approve leave, check fee dues, audit homework…"
                      disabled={isLoading}
                      style={{
                        flex: 1,
                        border: "none",
                        background: "transparent",
                        color: "var(--text-primary)",
                        fontSize: "var(--text-base)",
                        outline: "none",
                        padding: "0.65rem 0.5rem",
                      }}
                    />

                    {/* Upload File Button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title="Attach images, PDFs, CSVs or docs"
                      style={{
                        width: "38px",
                        height: "38px",
                        borderRadius: "50%",
                        border: "none",
                        background: attachments.length > 0 ? "rgba(99, 102, 241, 0.15)" : "transparent",
                        color: attachments.length > 0 ? "var(--brand-primary)" : "var(--text-secondary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        position: "relative",
                        flexShrink: 0,
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.background = "var(--bg-surface-hover)")}
                      onMouseOut={(e) => (e.currentTarget.style.background = attachments.length > 0 ? "rgba(99, 102, 241, 0.15)" : "transparent")}
                    >
                      <Paperclip size={18} />
                      {attachments.length > 0 && (
                        <span style={{
                          position: "absolute",
                          top: "4px",
                          right: "4px",
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: "var(--brand-primary)",
                        }} />
                      )}
                    </button>

                    {/* Mic Dictation Button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (!isSpeechSupported) {
                          toast.error("Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
                          return;
                        }
                        toggleListening();
                      }}
                      title="Click to speak with voice dictation"
                      style={{
                        width: "38px",
                        height: "38px",
                        borderRadius: "50%",
                        border: "none",
                        background: "transparent",
                        color: "var(--text-secondary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        flexShrink: 0,
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = "var(--bg-surface-hover)";
                        e.currentTarget.style.color = "var(--brand-primary)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--text-secondary)";
                      }}
                    >
                      <Mic size={18} />
                    </button>
                  </>
                )}
              </div>

              {/* Outside Circular 52px Button - Always constant position & geometry */}
              {isListening ? (
                <button
                  type="button"
                  onClick={() => {
                    stopListening();
                    if (input.trim() || attachments.length > 0) {
                      handleSend();
                    }
                  }}
                  title="Stop & Send voice prompt"
                  style={{
                    width: "52px",
                    height: "52px",
                    borderRadius: "50%",
                    border: "none",
                    background: "var(--brand-primary)",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    boxShadow: "var(--shadow-md)",
                    flexShrink: 0,
                  }}
                >
                  <ArrowUp size={22} strokeWidth={2.5} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={(!input.trim() && attachments.length === 0) || isLoading}
                  title="Send message"
                  style={{
                    width: "52px",
                    height: "52px",
                    borderRadius: "50%",
                    border: "none",
                    background: (input.trim() || attachments.length > 0) && !isLoading ? "var(--brand-primary)" : "var(--bg-surface-hover)",
                    color: (input.trim() || attachments.length > 0) && !isLoading ? "white" : "var(--text-tertiary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: (input.trim() || attachments.length > 0) && !isLoading ? "pointer" : "not-allowed",
                    transition: "all 0.2s",
                    boxShadow: (input.trim() || attachments.length > 0) && !isLoading ? "var(--shadow-md)" : "none",
                    flexShrink: 0,
                  }}
                >
                  {isLoading ? <Loader2 size={22} className="animate-spin" /> : <Send size={20} />}
                </button>
              )}
            </div>

            <p style={{ textAlign: "center", color: "var(--text-tertiary)", fontSize: "var(--text-xs)", marginTop: "0.75rem", marginBottom: 0 }}>
              Agentic AI can take real actions, analyze multimodal files & listen to voice dictation.
            </p>
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .typing-dot-lg {
          width: 8px; height: 8px; background-color: var(--brand-primary);
          border-radius: 50%; display: inline-block;
          animation: bounce 1.4s infinite ease-in-out both;
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes chipPopIn {
          0% { opacity: 0; transform: scale(0.85) translateY(4px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
      `,
        }}
      />
    </div>
  );
}
