import { create } from 'zustand';
import { Chapter, ShadowSuggestion } from '@/types';
import { countWords } from '@/lib/utils';
import * as chaptersService from '@/services/chapters';
interface EditorState {
  /** null while loading, or when no chapter is open. Also the editor's remount key. */
  chapterId: string | null;
  /**
   * Bumped whenever the buffer is replaced from outside the editor (snapshot
   * restore). Part of the TipTap mount key, so a replace remounts the editor
   * exactly like a chapter switch does — same path, same undo-history reset.
   */
  loadVersion: number;
  novelId: string | null;
  content: string;
  wordCount: number;
  isLoadingChapter: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
  saveError: string | null;
  shadowSuggestion: ShadowSuggestion | null;
  isRefining: boolean;
  beginLoad: () => void;
  loadChapter: (chapter: Chapter) => void;
  closeChapter: () => void;
  setContent: (content: string) => void;
  saveNow: () => Promise<void>;
  /** Cancel the debounce and persist immediately. Awaited before any switch. */
  flush: () => Promise<void>;
  /**
   * Swap the open chapter's buffer for server-authoritative content (snapshot
   * restore). Cancels any pending autosave first so a stale timer can never
   * write the old prose back over the restored text.
   */
  replaceChapterContent: (chapter: Chapter) => void;
  setShadowSuggestion: (suggestion: ShadowSuggestion | null) => void;
  acceptSuggestion: () => { from: number; to: number; text: string } | null;
  rejectSuggestion: () => void;
  setIsRefining: (isRefining: boolean) => void;
}
const AUTOSAVE_DELAY = 2000;
let autosaveTimeout: ReturnType<typeof setTimeout> | null = null;
function cancelPendingAutosave(): void {
  if (autosaveTimeout) {
    clearTimeout(autosaveTimeout);
    autosaveTimeout = null;
  }
}
export const useEditorStore = create<EditorState>((set, get) => ({
  chapterId: null,
  loadVersion: 0,
  novelId: null,
  content: '',
  wordCount: 0,
  isLoadingChapter: false,
  isSaving: false,
  lastSaved: null,
  hasUnsavedChanges: false,
  saveError: null,
  shadowSuggestion: null,
  isRefining: false,
  // chapterId stays null so <ChapterEditor key={chapterId}> doesn't mount
  // against an empty buffer and then get stranded when the content arrives.
  beginLoad: () => {
    cancelPendingAutosave();
    set({
      chapterId: null,
      content: '',
      wordCount: 0,
      isLoadingChapter: true,
      hasUnsavedChanges: false,
      lastSaved: null,
      saveError: null,
      shadowSuggestion: null,
    });
  },
  loadChapter: (chapter) =>
    set({
      chapterId: chapter.id,
      novelId: chapter.novelId,
      content: chapter.content,
      wordCount: chapter.wordCount,
      isLoadingChapter: false,
      hasUnsavedChanges: false,
      lastSaved: chapter.lastModified,
      saveError: null,
      shadowSuggestion: null,
    }),
  closeChapter: () => {
    cancelPendingAutosave();
    set({
      chapterId: null,
      novelId: null,
      content: '',
      wordCount: 0,
      isLoadingChapter: false,
      hasUnsavedChanges: false,
      lastSaved: null,
      saveError: null,
      shadowSuggestion: null,
    });
  },
  // Called synchronously from TipTap's onUpdate. The *store* owns the debounce
  // now, so the buffer is never newer than what flush() can see.
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
      // A chapter switch may have landed mid-flight — don't clobber the new buffer.
      if (get().chapterId !== chapterId) {
        set({ isSaving: false });
        return;
      }
      set({ isSaving: false, lastSaved: new Date(), hasUnsavedChanges: false });
    } catch (error) {
      console.error('Failed to save chapter:', error);
      set({ isSaving: false, saveError: 'Could not save this chapter.' });
    }
  },
  flush: async () => {
    cancelPendingAutosave();
    if (get().hasUnsavedChanges) await get().saveNow();
  },
  replaceChapterContent: (chapter) => {
    // Only meaningful for the chapter that's actually open — the caller may
    // have raced a chapter switch.
    if (get().chapterId !== chapter.id) return;
    cancelPendingAutosave();
    set((state) => ({
      content: chapter.content,
      wordCount: chapter.wordCount,
      hasUnsavedChanges: false,
      lastSaved: chapter.lastModified,
      saveError: null,
      shadowSuggestion: null,
      loadVersion: state.loadVersion + 1,
    }));
  },
  setShadowSuggestion: (suggestion) => set({ shadowSuggestion: suggestion }),
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
  rejectSuggestion: () => set({ shadowSuggestion: null }),
  setIsRefining: (isRefining) => set({ isRefining }),
}));
