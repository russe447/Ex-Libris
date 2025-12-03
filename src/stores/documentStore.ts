import { create } from 'zustand';
import { ShadowSuggestion } from '@/types';
import { generateId, countWords } from '@/lib/utils';

interface DocumentState {
  content: string;
  title: string;
  wordCount: number;
  shadowSuggestion: ShadowSuggestion | null;
  isRefining: boolean;
  
  setContent: (content: string) => void;
  setTitle: (title: string) => void;
  setShadowSuggestion: (suggestion: ShadowSuggestion | null) => void;
  acceptSuggestion: () => { from: number; to: number; text: string } | null;
  rejectSuggestion: () => void;
  setIsRefining: (isRefining: boolean) => void;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  content: '',
  title: 'Untitled',
  wordCount: 0,
  shadowSuggestion: null,
  isRefining: false,

  setContent: (content) =>
    set({
      content,
      wordCount: countWords(content),
    }),

  setTitle: (title) =>
    set({ title }),

  setShadowSuggestion: (suggestion) =>
    set({ shadowSuggestion: suggestion }),

  acceptSuggestion: () => {
    const { shadowSuggestion } = get();
    if (!shadowSuggestion) return null;

    const result = {
      from: shadowSuggestion.position.from,
      to: shadowSuggestion.position.to,
      text: shadowSuggestion.suggestedText,
    };

    set({ shadowSuggestion: null });

    return result;
  },

  rejectSuggestion: () =>
    set({ shadowSuggestion: null }),

  setIsRefining: (isRefining) =>
    set({ isRefining }),
}));