import { create } from "zustand";
import { apiClient } from "@/lib/axios";

export interface PendingAction {
  type: string;
  label: string;
  data: Record<string, unknown>;
}

export interface AIMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  pendingAction?: PendingAction | null;
}

interface AIState {
  isOpen: boolean;
  conversationId: string | null;
  messages: AIMessage[];
  isLoading: boolean;
  currentModule: string;
  toggle: () => void;
  setIsOpen: (isOpen: boolean) => void;
  setCurrentModule: (module: string) => void;
  sendMessage: (text: string) => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  clearConversation: () => void;
  executeAction: (action: { type: string; data: Record<string, unknown> }) => Promise<{ success: boolean; message: string }>;
}

export const useAIStore = create<AIState>((set, get) => ({
  isOpen: false,
  conversationId: null,
  messages: [],
  isLoading: false,
  currentModule: "Dashboard",

  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setIsOpen: (isOpen: boolean) => set({ isOpen }),
  setCurrentModule: (module: string) => set({ currentModule: module }),

  sendMessage: async (text: string) => {
    if (!text.trim()) return;
    const userMsg: AIMessage = { role: "user", content: text };
    set((state) => ({ messages: [...state.messages, userMsg], isLoading: true }));
    try {
      const state = get();
      const res = await apiClient.post("/ai/chat", {
        message: text,
        conversationId: state.conversationId,
      });
      const data = res.data.data || res.data;
      const assistantMsg: AIMessage = {
        role: "assistant",
        content: data.reply,
        pendingAction: data.pendingAction || null,
      };
      set((state) => ({
        conversationId: data.conversationId,
        messages: [...state.messages, assistantMsg],
        isLoading: false,
      }));
    } catch (error) {
      console.error("AI chat error:", error);
      set((state) => ({
        messages: [
          ...state.messages,
          { role: "assistant", content: "Sorry, I encountered an error. Please try again." },
        ],
        isLoading: false,
      }));
    }
  },

  executeAction: async (action: { type: string; data: Record<string, unknown> }) => {
    try {
      const res = await apiClient.post("/ai/action/execute", action);
      const data = res.data.data || res.data;
      return { success: data.success, message: data.message || "Action completed." };
    } catch {
      return { success: false, message: "Failed to execute action." };
    }
  },

  loadConversation: async (id: string) => {
    set({ isLoading: true });
    try {
      const res = await apiClient.get(`/ai/conversations/${id}`);
      const data = res.data.data || res.data;
      const msgs: AIMessage[] = (data.messages || []).map((m: { role: "user" | "assistant"; content: string }) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      }));
      set({ conversationId: id, messages: msgs, isLoading: false });
    } catch (error) {
      console.error("Failed to load conversation:", error);
      set({ isLoading: false });
    }
  },

  clearConversation: () => set({ conversationId: null, messages: [] }),
}));