import { create } from 'zustand';
import { ChatMessage } from '@/types';
import { generateId } from '@/lib/utils';

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  
  addMessage: (role: 'user' | 'assistant', content: string) => void;
  updateLastAssistantMessage: (content: string) => void;
  setIsLoading: (isLoading: boolean) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,

  addMessage: (role, content) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: generateId(),
          role,
          content,
          timestamp: new Date(),
        },
      ],
    })),

  updateLastAssistantMessage: (content) =>
    set((state) => {
      const messages = [...state.messages];
      const lastIndex = messages.length - 1;
      
      if (lastIndex >= 0 && messages[lastIndex].role === 'assistant') {
        messages[lastIndex] = { ...messages[lastIndex], content };
      }
      
      return { messages };
    }),

  setIsLoading: (isLoading) => set({ isLoading }),

  clearMessages: () => set({ messages: [] }),
}));
