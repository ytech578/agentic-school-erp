import { create } from "zustand";
import { apiClient } from "@/lib/axios";

// ─── Types ────────────────────────────────────────────────────────────────────

/** All possible terminal and non-terminal states the control plane can return */
export type AgentActionStatus =
  | "PROPOSED"
  | "AWAITING_CONFIRMATION"
  | "CONFIRMED"
  | "EXECUTING"
  | "SUCCEEDED"
  | "FAILED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED";

/** Extended pending action with full lifecycle fields */
export interface PendingAction {
  actionId: string;
  type: string;
  label: string;
  riskLevel?: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  status?: AgentActionStatus;
  requiresConfirmation?: boolean;
  expiresAt?: string;
  /** True when the server returned a cached SUCCEEDED result (idempotent) */
  idempotent?: boolean;
  data?: Record<string, unknown>;
}

/** Structured result from executeAction */
export interface ActionExecutionResult {
  success: boolean;
  /** Machine-readable status from the server */
  status: AgentActionStatus | null;
  /** User-facing message */
  message: string;
  /** Failure reason returned by the server (if any) */
  failureReason?: string;
}

export interface AttachmentItem {
  id?: string;
  name: string;
  type: string;
  size: number;
  base64: string;
  previewUrl?: string;
}

export interface AIMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  attachments?: AttachmentItem[];
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
  sendMessage: (text: string, attachments?: AttachmentItem[]) => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  clearConversation: () => void;
  /**
   * Confirms and executes a proposed action via the Agentic Control Plane.
   * Returns the full execution result — never claims success unless the server
   * returns status === 'SUCCEEDED'.
   */
  executeAction: (actionId: string) => Promise<ActionExecutionResult>;
  /**
   * Polls action status without executing — useful for checking if an
   * already-submitted action completed.
   */
  getActionStatus: (actionId: string) => Promise<ActionExecutionResult>;
}

// ─── Human-readable messages for all states ───────────────────────────────────

function statusToMessage(status: AgentActionStatus | null, failureReason?: string): string {
  switch (status) {
    case "SUCCEEDED":
      return "Action completed successfully.";
    case "FAILED":
      return failureReason
        ? `Action failed: ${failureReason.replace(/^[A-Z_]+: /, "")}`
        : "Action failed. Please try again.";
    case "REJECTED":
      return "Action was rejected. You do not have permission to perform this action.";
    case "EXPIRED":
      return "This action has expired. Please start over.";
    case "CANCELLED":
      return "Action was cancelled.";
    case "EXECUTING":
      return "Action is currently being executed…";
    case "AWAITING_CONFIRMATION":
      return "Awaiting your confirmation.";
    case "CONFIRMED":
      return "Action confirmed — waiting to execute.";
    case "PROPOSED":
      return "Action proposed — please review and confirm.";
    default:
      return "Unknown action status.";
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAIStore = create<AIState>((set, get) => ({
  isOpen: false,
  conversationId: null,
  messages: [],
  isLoading: false,
  currentModule: "Dashboard",

  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setIsOpen: (isOpen: boolean) => set({ isOpen }),
  setCurrentModule: (module: string) => set({ currentModule: module }),

  sendMessage: async (text: string, attachments?: AttachmentItem[]) => {
    if (!text.trim() && (!attachments || attachments.length === 0)) return;
    const userMsg: AIMessage = { role: "user", content: text, attachments };
    set((state) => ({ messages: [...state.messages, userMsg], isLoading: true }));
    try {
      const state = get();
      const res = await apiClient.post("/ai/chat", {
        message: text,
        conversationId: state.conversationId,
        attachments: attachments && attachments.length > 0 ? attachments : undefined,
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
          {
            role: "assistant",
            content: "Sorry, I encountered an error. Please try again.",
          },
        ],
        isLoading: false,
      }));
    }
  },

  /**
   * Phase 18 — Full status handling.
   * Never claims success unless the server returns status === 'SUCCEEDED'.
   * Shows failure reason for FAILED actions.
   * Handles EXPIRED and REJECTED explicitly.
   */
  executeAction: async (actionId: string): Promise<ActionExecutionResult> => {
    try {
      const res = await apiClient.post(`/ai/action/${actionId}/confirm`);
      const data: {
        status?: AgentActionStatus;
        actionId?: string;
        failureReason?: string;
      } = res.data.data || res.data;

      const status = data.status ?? null;
      const failureReason = data.failureReason;
      const success = status === "SUCCEEDED";

      return {
        success,
        status,
        message: statusToMessage(status, failureReason),
        failureReason,
      };
    } catch (error: unknown) {
      // Extract error detail from axios response if available
      const axiosError = error as { response?: { data?: { message?: string; error?: string } }; message?: string };
      const serverMsg =
        axiosError?.response?.data?.message ||
        axiosError?.response?.data?.error ||
        axiosError?.message ||
        "Failed to execute action.";

      return {
        success: false,
        status: null,
        message: serverMsg,
        failureReason: serverMsg,
      };
    }
  },

  getActionStatus: async (actionId: string): Promise<ActionExecutionResult> => {
    try {
      const res = await apiClient.get(`/ai/action/${actionId}`);
      const data: {
        status?: AgentActionStatus;
        failureReason?: string;
      } = res.data.data || res.data;

      const status = data.status ?? null;
      return {
        success: status === "SUCCEEDED",
        status,
        message: statusToMessage(status, data.failureReason),
        failureReason: data.failureReason,
      };
    } catch {
      return { success: false, status: null, message: "Could not retrieve action status." };
    }
  },

  loadConversation: async (id: string) => {
    set({ isLoading: true });
    try {
      const res = await apiClient.get(`/ai/conversations/${id}`);
      const data = res.data.data || res.data;
      const msgs: AIMessage[] = (
        data.messages || []
      ).map((m: { role: "user" | "assistant"; content: string }) => ({
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