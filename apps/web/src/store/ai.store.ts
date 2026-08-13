import { create } from 'zustand';
import { apiClient } from '@/lib/axios';

interface AIMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
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
  clearConversation: () => void;
}

export const useAIStore = create<AIState>((set, get) => ({
  isOpen: false,
  conversationId: null,
  messages: [],
  isLoading: false,
  currentModule: 'Dashboard',
  
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setIsOpen: (isOpen: boolean) => set({ isOpen }),
  setCurrentModule: (module: string) => set({ currentModule: module }),
  
  sendMessage: async (text: string) => {
    if (!text.trim()) return;
    
    // Add user message optimistically
    const userMsg: AIMessage = { role: 'user', content: text };
    set((state) => ({
      messages: [...state.messages, userMsg],
      isLoading: true
    }));
    
    try {
      const state = get();
      const res = await apiClient.post('/ai/chat', {
        message: text,
        conversationId: state.conversationId
      });
      
      const data = res.data.data || res.data;
      
      const assistantMsg: AIMessage = { role: 'assistant', content: data.reply };
      set((state) => ({
        conversationId: data.conversationId,
        messages: [...state.messages, assistantMsg],
        isLoading: false
      }));
    } catch (error) {
      console.error('AI chat error:', error);
      const errorMsg: AIMessage = { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      };
      set((state) => ({
        messages: [...state.messages, errorMsg],
        isLoading: false
      }));
    }
  },
  
  clearConversation: () => set({ conversationId: null, messages: [] })
}));
