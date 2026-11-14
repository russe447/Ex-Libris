// src/stores/chapterFilterStore.ts
//
// The active chapter filter — ONE filter, shared by the Corkboard and the
// sidebar chapter list, so "show me Mara's chapters" follows you between
// views. Filtering decides visibility only; it never touches any order and is
// deliberately not persisted (a filter is a question, not a setting). Cleared
// on novel switch by libraryStore.

import { create } from 'zustand';
import { ChapterFilter, ChapterStatus, EMPTY_FILTER } from '@/lib/chapterMeta';

interface ChapterFilterState extends ChapterFilter {
  toggleStatus: (status: ChapterStatus) => void;
  setPov: (pov: string | null) => void;
  toggleTag: (tag: string) => void;
  clearFilters: () => void;
}

export const useChapterFilterStore = create<ChapterFilterState>((set) => ({
  ...EMPTY_FILTER,

  toggleStatus: (status) =>
    set((state) => ({
      statuses: state.statuses.includes(status)
        ? state.statuses.filter((candidate) => candidate !== status)
        : [...state.statuses, status],
    })),

  setPov: (pov) => set({ pov: pov || null }),

  toggleTag: (tag) =>
    set((state) => {
      const key = tag.toLowerCase();
      const has = state.tags.some((candidate) => candidate.toLowerCase() === key);
      return {
        tags: has
          ? state.tags.filter((candidate) => candidate.toLowerCase() !== key)
          : [...state.tags, tag],
      };
    }),

  clearFilters: () => set({ ...EMPTY_FILTER }),
}));
