"use client";

import { useEffect, useRef, useState } from "react";
import { useAIStore } from "@/store/ai.store";
import { Sparkles, X, Send, User, Bot, Loader2, Maximize2 } from "lucide-react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";

export default function AIChatWidget() {
  const { isOpen, toggle, messages, sendMessage, isLoading } = useAIStore();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    const text = input;
    setInput("");
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const chips = [
    "Who has below 75% attendance?",
    "Show me today's fee collection",
    "How do I admit a new student?",
  ];

  if (!isOpen) {
    return (
      <button
        onClick={toggle}
        style={{
          position: "fixed", bottom: "2rem", right: "2rem", zIndex: 100,
          width: "56px", height: "56px", borderRadius: "50%",
          background: "var(--primary-500)",
          backgroundImage: "var(--brand-gradient)",
          color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "var(--shadow-lg), 0 0 20px rgba(99, 102, 241, 0.4)",
          border: "none", cursor: "pointer", transition: "transform 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        <Sparkles size={24} />
      </button>
    );
  }

  return (
    <div style={{
      position: "fixed", bottom: "5rem", right: "2rem", zIndex: 100,
      width: "350px", height: "500px", background: "var(--bg-surface)",
      borderRadius: "var(--radius-xl)", border: "1px solid var(--border-light)",
      backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
      boxShadow: "var(--shadow-xl)", display: "flex", flexDirection: "column",
      overflow: "hidden", animation: "fadeInUp 0.3s ease-out"
    }}>
      <div style={{
        background: "var(--primary-500)",
        backgroundImage: "var(--brand-gradient)",
        padding: "1rem", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Sparkles size={20} />
          <span style={{ fontWeight: 600 }}>AI Assistant</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button onClick={() => { toggle(); router.push("/ai"); }} style={{ background: "none", border: "none", color: "#ffffff", cursor: "pointer", opacity: 0.9 }} title="Open Full Page">
            <Maximize2 size={18} />
          </button>
          <button onClick={toggle} style={{ background: "none", border: "none", color: "#ffffff", cursor: "pointer", opacity: 0.9 }}>
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        {messages.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "1.5rem", color: "var(--text-secondary)", textAlign: "center" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "var(--primary-100)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Sparkles size={32} color="var(--primary-500)" />
            </div>
            <div>
              <p style={{ fontWeight: "var(--font-medium)", color: "var(--text-primary)", marginBottom: "0.5rem" }}>How can I help you today?</p>
              <p style={{ fontSize: "var(--text-sm)" }}>Ask me about students, fees, attendance, or system navigation.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%" }}>
              {chips.map(c => (
                <button key={c} onClick={() => sendMessage(c)}
                  style={{
                    padding: "0.5rem 1rem", background: "var(--bg-surface)", border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-full)", fontSize: "0.75rem", color: "var(--primary-500)",
                    cursor: "pointer", textAlign: "left", transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--primary-500)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", gap: "0.75rem", alignSelf: msg.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
              {msg.role === "assistant" && (
                <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "var(--primary-100)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Bot size={16} color="var(--primary-500)" />
                </div>
              )}
              <div style={{
                padding: "0.75rem 1rem", borderRadius: "var(--radius-xl)", fontSize: "0.875rem",
                background: msg.role === "user" ? "var(--primary-500)" : "var(--bg-surface)",
                color: msg.role === "user" ? "white" : "var(--text-primary)",
                border: msg.role === "assistant" ? "1px solid var(--border-light)" : "none",
                borderTopRightRadius: msg.role === "user" ? "4px" : "var(--radius-xl)",
                borderTopLeftRadius: msg.role === "assistant" ? "4px" : "var(--radius-xl)",
                boxShadow: "var(--shadow-sm)",
              }}>
                {msg.role === "user" ? (
                  msg.content
                ) : (
                  <div className="prose prose-sm dark:prose-invert" style={{ margin: 0 }}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )}
                
                {/* Auto-navigation buttons if AI suggests a route */}
                {msg.role === "assistant" && msg.content.includes("(/") && (
                  <div style={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {Array.from(msg.content.matchAll(/\[(.*?)\]\((.*?)\)/g)).map((match, idx) => (
                      <button key={idx} onClick={() => { toggle(); router.push(match[2]); }}
                        style={{
                          background: "var(--primary-500)", color: "white", border: "none",
                          padding: "0.25rem 0.75rem", borderRadius: "var(--radius-full)",
                          fontSize: "0.75rem", cursor: "pointer", fontWeight: "600"
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
          <div style={{ display: "flex", gap: "0.75rem", alignSelf: "flex-start", maxWidth: "85%" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "var(--primary-100)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Bot size={16} color="var(--primary-500)" />
            </div>
            <div style={{ background: "var(--bg-surface)", padding: "0.75rem 1rem", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)", display: "flex", gap: "0.25rem" }}>
              <span className="typing-dot" style={{ animationDelay: "0s" }} />
              <span className="typing-dot" style={{ animationDelay: "0.2s" }} />
              <span className="typing-dot" style={{ animationDelay: "0.4s" }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "1rem", borderTop: "1px solid var(--border-default)", background: "var(--bg-surface)" }}>
        <form onSubmit={handleSend} style={{ display: "flex", gap: "0.5rem" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI anything..."
            disabled={isLoading}
            style={{
              flex: 1, padding: "0.75rem 1rem", borderRadius: "var(--radius-full)",
              border: "1px solid var(--border-default)", background: "var(--bg-input)",
              color: "var(--text-primary)", fontSize: "var(--text-sm)", outline: "none"
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            style={{
              width: "40px", height: "40px", borderRadius: "50%", border: "none",
              background: input.trim() && !isLoading ? "var(--primary-500)" : "var(--bg-elevated)",
              color: input.trim() && !isLoading ? "white" : "var(--text-tertiary)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: input.trim() && !isLoading ? "pointer" : "not-allowed",
              transition: "all 0.2s"
            }}
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </form>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .typing-dot {
          width: 6px; height: 6px; background-color: var(--primary-500);
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
