// src/stores/splitEditorStore.ts
//
// The split pane's buffer — used ONLY when the split pane shows a different
// chapter than the primary editor. (Same chapter in both panes is handled by
// mirroring the primary's ProseMirror document instead; see SplitPane.tsx.)
//
// Deliberately a sibling of editorStore, not a replacement: the two buffers
// always hold different chapters, so their debounced autosaves can never race
// each other over one row. Each store owns its own timer.

import { create } from 'zustand';
import { Chapter } from '@/types';
import { countWords } from '@/lib/utils';
import * as chaptersService from '@/services/chapters';

interface SplitEditorState {
  chapterId: string | null;
  novelId: string | null;
  content: string;
  wordCount: number;
  isLoading: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  saveError: string | null;
  /** Part of the TipTap mount key, like editorStore's. */
  loadVersion: number;

  /** Load a chapter into the pane; flushes whatever was there first. */
  open: (novelId: string, chapterId: string) => Promise<void>;
  setContent: (content: string) => void;
  saveNow: () => Promise<void>;
  flush: () => Promise<void>;
  /** Flush (unless the chapter was just deleted) and empty the pane. */
  close: (options?: { flush?: boolean }) => Promise<void>;
}

const AUTOSAVE_DELAY = 2000;
let autosaveTimeout: ReturnType<typeof setTimeout> | null = null;
let openRequestId = 0;

function cancelPendingAutosave(): void {
  if (autosaveTimeout) {
    clearTimeout(autosaveTimeout);
    autosaveTimeout = null;
  }
}

export const useSplitEditorStore = create<SplitEditorState>((set, get) => ({
  chapterId: null,
  novelId: null,
  content: '',
  wordCount: 0,
  isLoading: false,
  isSaving: false,
  hasUnsavedChanges: false,
  saveError: null,
  loadVersion: 0,

  open: async (novelId, chapterId) => {
    if (get().chapterId === chapterId && get().novelId === novelId) return;
    await get().flush(); // never abandon edits made in the pane
    const requestId = ++openRequestId;
    cancelPendingAutosave();
    set({
      chapterId: null,
      novelId,
      content: '',
      wordCount: 0,
      isLoading: true,
      hasUnsavedChanges: false,
      saveError: null,
    });
    try {
      const chapter: Chapter = await chaptersService.fetchChapter(novelId, chapterId);
      if (requestId !== openRequestId) return; // a later open superseded us
      set((state) => ({
        chapterId: chapter.id,
        novelId: chapter.novelId,
        content: chapter.content,
        wordCount: chapter.wordCount,
        isLoading: false,
        hasUnsavedChanges: false,
        saveError: null,
        loadVersion: state.loadVersion + 1,
      }));
    } catch (error) {
      console.error('Failed to load split chapter:', error);
      if (requestId !== openRequestId) return;
      set({ isLoading: false, saveError: 'Could not load that chapter.' });
    }
  },

  setContent: (content) => {
    const { chapterId, content: current } = get();
    if (!chapterId || content === current) return;
    set({ content, wordCount: countWords(content), hasUnsavedChanges: true });
    cancelPendingAutosave();
    autosaveTimeout = setTimeout(() => {
      void get().saveNow();
    }, AUTOSAVE_DELAY);
  },

  saveNow: async () => {
    const { chapterId, novelId, content, wordCount, isSaving, hasUnsavedChanges } = get();
    if (!chapterId || !novelId || isSaving || !hasUnsavedChanges) return;
    cancelPendingAutosave();
    set({ isSaving: true, saveError: null });
    try {
      await chaptersService.updateChapter(novelId, chapterId, { content, wordCount });
      // The pane may have switched chapters mid-flight — don't clobber it.
      if (get().chapterId !== chapterId) {
        set({ isSaving: false });
        return;
      }
      set({ isSaving: false, hasUnsavedChanges: false });
    } catch (error) {
      console.error('Failed to save split chapter:', error);
      set({ isSaving: false, saveError: 'Could not save this chapter.' });
    }
  },

  flush: async () => {
    cancelPendingAutosave();
    if (get().hasUnsavedChanges) await get().saveNow();
  },

  close: async ({ flush = true } = {}) => {
    openRequestId++; // cancel any in-flight open
    if (flush) await get().flush();
    cancelPendingAutosave();
    set({
      chapterId: null,
      novelId: null,
      content: '',
      wordCount: 0,
      isLoading: false,
      isSaving: false,
      hasUnsavedChanges: false,
      saveError: null,
    });
  },
}));
