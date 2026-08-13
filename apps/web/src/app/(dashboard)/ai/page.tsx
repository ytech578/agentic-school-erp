"use client";

import { useEffect, useRef, useState } from "react";
import { useAIStore } from "@/store/ai.store";
import { Sparkles, Send, Bot, Loader2, MessageSquare, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";

export default function AIFullPage() {
  const { messages, sendMessage, isLoading, conversationId, clearConversation } = useAIStore();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    fetchHistory();
  }, [conversationId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const fetchHistory = async () => {
    try {
      const res = await apiClient.get("/ai/conversations");
      setHistory(res.data.data || res.data || []);
    } catch {}
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    const text = input;
    setInput("");
    await sendMessage(text);
    fetchHistory(); // Refresh history
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiClient.delete(`/ai/conversations/${id}`);
      if (conversationId === id) clearConversation();
      fetchHistory();
    } catch {}
  };

  const chips = [
    "Who are the top 5 students in Class 10?",
    "Show me today's fee collection",
    "Which staff members are absent today?",
    "Write an email to parents about the upcoming parent-teacher meeting",
  ];

  return (
    <div style={{ display: "flex", height: "calc(100vh - 120px)", gap: "1.5rem" }}>
      
      {/* Sidebar History */}
      <div style={{ width: "280px", background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "1.5rem", borderBottom: "1px solid var(--border-default)" }}>
          <Button onClick={clearConversation} style={{ width: "100%", justifyContent: "center" }}>
            <Plus size={16} style={{ marginRight: "0.5rem" }} /> New Chat
          </Button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {history.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--text-tertiary)", fontSize: "var(--text-sm)", marginTop: "2rem" }}>No previous chats</p>
          ) : (
            history.map(conv => (
              <div key={conv.id} 
                onClick={() => {
                  // In a real app, this would fetch the conversation messages and update the store
                  // For MVP, we'll just show it's clickable
                  alert("Conversation history viewing coming in Phase 2");
                }}
                style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0.75rem 1rem", borderRadius: "var(--radius-md)", cursor: "pointer",
                background: conversationId === conv.id ? "var(--bg-active)" : "transparent",
                color: conversationId === conv.id ? "var(--text-primary)" : "var(--text-secondary)",
                transition: "background var(--duration-fast)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", overflow: "hidden" }}>
                  <MessageSquare size={16} />
                  <span style={{ fontSize: "var(--text-sm)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {conv.title || "New Chat"}
                  </span>
                </div>
                <button onClick={(e) => handleDelete(conv.id, e)} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={{ flex: 1, background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "1.5rem", borderBottom: "1px solid var(--border-default)", display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "var(--radius-md)", background: "linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-tertiary) 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
            <Sparkles size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-bold)" }}>AI Assistant</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>Powered by Google Gemini 1.5</p>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {messages.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "2rem", textAlign: "center", maxWidth: "600px", margin: "0 auto" }}>
              <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "var(--brand-primary-light)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Sparkles size={40} color="var(--brand-primary)" />
              </div>
              <div>
                <h3 style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)", marginBottom: "0.5rem" }}>How can I help you today?</h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-base)" }}>I can help you navigate the system, analyze data, and answer questions about students, fees, and attendance.</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", width: "100%" }}>
                {chips.map(c => (
                  <button key={c} onClick={() => sendMessage(c)}
                    style={{
                      padding: "1rem", background: "var(--bg-elevated)", border: "1px solid var(--border-default)",
                      borderRadius: "var(--radius-lg)", fontSize: "var(--text-sm)", color: "var(--text-primary)",
                      cursor: "pointer", textAlign: "left", transition: "all 0.2s", boxShadow: "var(--shadow-sm)"
                    }}
                    onMouseEnter={(e) => { (e.currentTarget.style.borderColor = "var(--brand-primary)"); (e.currentTarget.style.transform = "translateY(-2px)"); }}
                    onMouseLeave={(e) => { (e.currentTarget.style.borderColor = "var(--border-default)"); (e.currentTarget.style.transform = "translateY(0)"); }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", gap: "1rem", alignSelf: msg.role === "user" ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                {msg.role === "assistant" && (
                  <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--brand-primary-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Bot size={20} color="var(--brand-primary)" />
                  </div>
                )}
                <div style={{
                  background: msg.role === "user" ? "var(--brand-primary)" : "var(--bg-elevated)",
                  color: msg.role === "user" ? "white" : "var(--text-primary)",
                  padding: "1.25rem",
                  borderRadius: "var(--radius-xl)",
                  border: msg.role === "assistant" ? "1px solid var(--border-default)" : "none",
                  fontSize: "var(--text-base)", lineHeight: 1.6,
                  borderTopRightRadius: msg.role === "user" ? "4px" : "var(--radius-xl)",
                  borderTopLeftRadius: msg.role === "assistant" ? "4px" : "var(--radius-xl)",
                  boxShadow: "var(--shadow-md)",
                }}>
                  {msg.role === "user" ? (
                    msg.content
                  ) : (
                    <div className="prose dark:prose-invert" style={{ margin: 0, maxWidth: "none" }}>
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                  
                  {msg.role === "assistant" && msg.content.includes("(/") && (
                    <div style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                      {Array.from(msg.content.matchAll(/\[(.*?)\]\((.*?)\)/g)).map((match, idx) => (
                        <button key={idx} onClick={() => router.push(match[2])}
                          style={{
                            background: "var(--brand-primary)", color: "white", border: "none",
                            padding: "0.375rem 1rem", borderRadius: "var(--radius-full)",
                            fontSize: "var(--text-sm)", cursor: "pointer", fontWeight: "var(--font-medium)"
                          }}>
                          Go to {match[1]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div style={{ display: "flex", gap: "1rem", alignSelf: "flex-start", maxWidth: "80%" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--brand-primary-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Bot size={20} color="var(--brand-primary)" />
              </div>
              <div style={{ background: "var(--bg-elevated)", padding: "1.25rem", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-default)", display: "flex", gap: "0.5rem" }}>
                <span className="typing-dot-lg" style={{ animationDelay: "0s" }} />
                <span className="typing-dot-lg" style={{ animationDelay: "0.2s" }} />
                <span className="typing-dot-lg" style={{ animationDelay: "0.4s" }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{ padding: "1.5rem", borderTop: "1px solid var(--border-default)", background: "var(--bg-elevated)" }}>
          <form onSubmit={handleSend} style={{ display: "flex", gap: "1rem", maxWidth: "800px", margin: "0 auto" }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message AI Assistant..."
              disabled={isLoading}
              style={{
                flex: 1, padding: "1rem 1.5rem", borderRadius: "var(--radius-full)",
                border: "1px solid var(--border-default)", background: "var(--bg-input)",
                color: "var(--text-primary)", fontSize: "var(--text-base)", outline: "none",
                boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)"
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              style={{
                width: "56px", height: "56px", borderRadius: "50%", border: "none",
                background: input.trim() && !isLoading ? "var(--brand-primary)" : "var(--bg-surface)",
                color: input.trim() && !isLoading ? "white" : "var(--text-tertiary)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: input.trim() && !isLoading ? "pointer" : "not-allowed",
                transition: "all 0.2s", boxShadow: input.trim() && !isLoading ? "var(--shadow-md)" : "none"
              }}
            >
              {isLoading ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} />}
            </button>
          </form>
          <p style={{ textAlign: "center", color: "var(--text-tertiary)", fontSize: "var(--text-xs)", marginTop: "1rem" }}>
            AI Assistant can make mistakes. Check important information before acting.
          </p>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .typing-dot-lg {
          width: 8px; height: 8px; background-color: var(--brand-primary);
          border-radius: 50%; display: inline-block;
          animation: bounce 1.4s infinite ease-in-out both;
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}} />
    </div>
  );
}
