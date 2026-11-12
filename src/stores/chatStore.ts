import { create } from 'zustand';
import { ChatMessage, CodexEntryRef } from '@/types';
import { generateId } from '@/lib/utils';
import * as chatService from '@/services/chat';

interface ChatState {
  activeNovelId: string | null;
  messages: ChatMessage[];
  isLoading: boolean;        // assistant is streaming
  isLoadingHistory: boolean; // fetching persisted messages
  error: string | null;

  /** Swap the conversation to another document (null = no document). */
  setActiveNovel: (novelId: string | null) => Promise<void>;
  addMessage: (
    role: 'user' | 'assistant',
    content: string,
    codexEntries?: CodexEntryRef[]
  ) => ChatMessage;
  updateMessageContent: (
    messageId: string,
    content: string,
    novelId?: string | null
  ) => void;
  persistMessage: (message: ChatMessage, novelId?: string | null) => Promise<void>;
  setIsLoading: (isLoading: boolean) => void;
  clearMessages: () => Promise<void>;
}

/**
 * Guards against out-of-order history fetches when the user switches
 * documents faster than the network responds.
 */
let historyRequestId = 0;

export const useChatStore = create<ChatState>((set, get) => ({
  activeNovelId: null,
  messages: [],
  isLoading: false,
  isLoadingHistory: false,
  error: null,

  setActiveNovel: async (novelId) => {
    if (get().activeNovelId === novelId) return;

    const requestId = ++historyRequestId;

    // Clear immediately so the panel never shows another doc's conversation.
    set({
      activeNovelId: novelId,
      messages: [],
      error: null,
      isLoadingHistory: novelId !== null,
    });

    if (!novelId) return;

    try {
      const messages = await chatService.fetchMessages(novelId);
      if (requestId !== historyRequestId) return; // a newer switch won
      set({ messages, isLoadingHistory: false });
    } catch (error) {
      console.error('Failed to load chat history:', error);
      if (requestId !== historyRequestId) return;
      set({ isLoadingHistory: false, error: 'Could not load this conversation.' });
    }
  },

  addMessage: (role, content, codexEntries) => {
    const message: ChatMessage = {
      id: generateId(),
      role,
      content,
      timestamp: new Date(),
      ...(codexEntries && codexEntries.length > 0 ? { codexEntries } : {}),
    };
    set((state) => ({ messages: [...state.messages, message] }));
    return message;
  },

  updateMessageContent: (messageId, content, novelId) => {
    // Ignore streamed tokens that belong to a document we've navigated away from.
    if (novelId !== undefined && get().activeNovelId !== novelId) return;
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === messageId ? { ...message, content } : message
      ),
    }));
  },

  persistMessage: async (message, novelId) => {
    const targetId = novelId ?? get().activeNovelId;
    if (!targetId) return; // nothing to persist to
    try {
      await chatService.saveMessage(targetId, message);
    } catch (error) {
      console.error('Failed to persist chat message:', error);
      if (get().activeNovelId === targetId) {
        set({ error: 'Message could not be saved.' });
      }
    }
  },

  setIsLoading: (isLoading) => set({ isLoading }),

  clearMessages: async () => {
    const { activeNovelId } = get();
    const previous = get().messages;
    set({ messages: [], error: null });
    if (!activeNovelId) return;
    try {
      await chatService.clearMessages(activeNovelId);
    } catch (error) {
      console.error('Failed to clear chat history:', error);
      // Restore so the UI doesn't lie about what's on the server.
      if (get().activeNovelId === activeNovelId) {
        set({ messages: previous, error: 'Could not clear this conversation.' });
      }
    }
  },
}));
