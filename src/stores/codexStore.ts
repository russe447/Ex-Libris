import { create } from 'zustand';
import { CodexEntry, CodexEntryType, CodexSuggestion, ManuscriptChapter } from '@/types';
import { generateId } from '@/lib/utils';
import { CODEX_TYPE_ORDER } from '@/lib/codex';
import {
  buildSuggestions,
  finalizeTally,
  mergeTallies,
  tallyHtml,
  type NameTally,
} from '@/lib/nameSuggestions';
import * as codexService from '@/services/codex';
const SUGGESTIONS_ENABLED_KEY = 'exlibris_codex_suggestions';
interface CodexState {
  activeNovelId: string | null;
  entries: CodexEntry[];
  selectedEntryIds: string[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  suggestions: CodexSuggestion[];
  dismissedKeys: string[];
  suggestionsEnabled: boolean;
  pendingSuggestionKey: string | null;
  /** True once every chapter of the novel has been tallied at least once. */
  manuscriptScanned: boolean;
  setActiveNovel: (novelId: string | null) => Promise<void>;
  createEntry: (type: CodexEntryType, name: string) => Promise<CodexEntry | null>;
  updateEntry: (entryId: string, updates: { type?: CodexEntryType; name?: string; fields?: Record<string, string> }) => Promise<void>;
  deleteEntry: (entryId: string) => Promise<void>;
  toggleEntrySelection: (entryId: string) => void;
  clearSelection: () => void;
  getSelectedEntries: () => CodexEntry[];
  ingestManuscript: (novelId: string, chapters: ManuscriptChapter[]) => void;
  scanChapter: (novelId: string, chapterId: string, html: string) => void;
  dropChapterTally: (chapterId: string) => void;
  createEntryFromSuggestion: (key: string, type: CodexEntryType) => Promise<CodexEntry | null>;
  dismissSuggestion: (key: string) => Promise<void>;
  restoreDismissed: () => Promise<void>;
  setSuggestionsEnabled: (enabled: boolean) => void;
}
let codexRequestId = 0;
/**
 * Per-chapter name tallies for the active novel, kept OUT of zustand state:
 * nothing renders them, and they change on every keystroke. The novel id is
 * stored alongside so a stale scan can never pollute another novel's codex.
 */
let tallyNovelId: string | null = null;
const chapterTallies = new Map<string, NameTally>();
/** Reading order, so the merged `context` snippet is the earliest occurrence. */
let tallyOrder: string[] = [];
function resetTallies(novelId: string | null): void {
  tallyNovelId = novelId;
  tallyOrder = [];
  chapterTallies.clear();
}
function orderedTallies(): NameTally[] {
  return tallyOrder.map((id) => chapterTallies.get(id)).filter(Boolean) as NameTally[];
}
function sortEntries(entries: CodexEntry[]): CodexEntry[] {
  return [...entries].sort((a, b) => {
    const typeDiff = CODEX_TYPE_ORDER.indexOf(a.type) - CODEX_TYPE_ORDER.indexOf(b.type);
    if (typeDiff !== 0) return typeDiff;
    return a.name.localeCompare(b.name);
  });
}
function suggestionsEqual(a: CodexSuggestion[], b: CodexSuggestion[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].key !== b[i].key || a[i].name !== b[i].name || a[i].type !== b[i].type || a[i].count !== b[i].count) {
      return false;
    }
  }
  return true;
}
function readSuggestionsEnabled(): boolean {
  try {
    return localStorage.getItem(SUGGESTIONS_ENABLED_KEY) !== 'off';
  } catch {
    return true;
  }
}
export const useCodexStore = create<CodexState>((set, get) => {
  /** Merge every chapter tally → thresholds → subtract entries + dismissals. */
  const recompute = () =>
    set((state) => {
      if (!state.suggestionsEnabled || chapterTallies.size === 0) {
        return state.suggestions.length > 0 ? { suggestions: [] } : {};
      }
      const candidates = finalizeTally(mergeTallies(orderedTallies()));
      const next = buildSuggestions(candidates, state.entries, state.dismissedKeys);
      return suggestionsEqual(state.suggestions, next) ? {} : { suggestions: next };
    });
  return {
    activeNovelId: null,
    entries: [],
    selectedEntryIds: [],
    isLoading: false,
    isSaving: false,
    error: null,
    suggestions: [],
    dismissedKeys: [],
    suggestionsEnabled: readSuggestionsEnabled(),
    pendingSuggestionKey: null,
    manuscriptScanned: false,
    setActiveNovel: async (novelId) => {
      if (get().activeNovelId === novelId) return;
      const requestId = ++codexRequestId;
      resetTallies(novelId);
      set({
        activeNovelId: novelId,
        entries: [],
        selectedEntryIds: [],
        suggestions: [],
        dismissedKeys: [],
        pendingSuggestionKey: null,
        manuscriptScanned: false,
        error: null,
        isLoading: novelId !== null,
      });
      if (!novelId) return;
      try {
        const [entries, dismissed] = await Promise.all([
          codexService.fetchEntries(novelId),
          codexService.fetchDismissedSuggestions(novelId).catch((error) => {
            console.warn('Failed to load dismissed suggestions:', error);
            return [];
          }),
        ]);
        if (requestId !== codexRequestId) return;
        set({
          entries: sortEntries(entries),
          dismissedKeys: dismissed.map((d) => d.nameKey),
          isLoading: false,
        });
        recompute();
      } catch (error) {
        console.error('Failed to load codex:', error);
        if (requestId !== codexRequestId) return;
        set({ isLoading: false, error: 'Could not load the codex.' });
      }
    },
    createEntry: async (type, name) => {
      const novelId = get().activeNovelId;
      if (!novelId) return null;
      set({ isSaving: true, error: null });
      try {
        const entry = await codexService.createEntry(novelId, { id: generateId(), type, name });
        if (get().activeNovelId === novelId) {
          set((state) => ({ entries: sortEntries([...state.entries, entry]), isSaving: false }));
          recompute();
        } else {
          set({ isSaving: false });
        }
        return entry;
      } catch (error) {
        console.error('Failed to create codex entry:', error);
        set({ isSaving: false, error: 'Could not create the entry.' });
        return null;
      }
    },
    updateEntry: async (entryId, updates) => {
      const novelId = get().activeNovelId;
      if (!novelId) return;
      set({ isSaving: true, error: null });
      try {
        const updated = await codexService.updateEntry(novelId, entryId, updates);
        if (get().activeNovelId === novelId) {
          set((state) => ({
            entries: sortEntries(state.entries.map((e) => (e.id === entryId ? updated : e))),
            isSaving: false,
          }));
          recompute();
        } else {
          set({ isSaving: false });
        }
      } catch (error) {
        console.error('Failed to update codex entry:', error);
        set({ isSaving: false, error: 'Could not save the entry.' });
        throw error;
      }
    },
    deleteEntry: async (entryId) => {
      const novelId = get().activeNovelId;
      if (!novelId) return;
      try {
        await codexService.deleteEntry(novelId, entryId);
        if (get().activeNovelId === novelId) {
          set((state) => ({
            entries: state.entries.filter((e) => e.id !== entryId),
            selectedEntryIds: state.selectedEntryIds.filter((id) => id !== entryId),
          }));
          recompute();
        }
      } catch (error) {
        console.error('Failed to delete codex entry:', error);
        set({ error: 'Could not delete the entry.' });
      }
    },
    toggleEntrySelection: (entryId) =>
      set((state) => ({
        selectedEntryIds: state.selectedEntryIds.includes(entryId)
          ? state.selectedEntryIds.filter((id) => id !== entryId)
          : [...state.selectedEntryIds, entryId],
      })),
    clearSelection: () => set({ selectedEntryIds: [] }),
    getSelectedEntries: () => {
      const { entries, selectedEntryIds } = get();
      return entries.filter((e) => selectedEntryIds.includes(e.id));
    },
    // --- novel-wide suggestion scanning ---
    /** One pass over the whole novel. Texts are discarded; only tallies persist. */
    ingestManuscript: (novelId, chapters) => {
      if (!get().suggestionsEnabled || get().activeNovelId !== novelId) return;
      resetTallies(novelId);
      const ordered = [...chapters].sort((a, b) => a.position - b.position);
      for (const chapter of ordered) {
        tallyOrder.push(chapter.id);
        chapterTallies.set(chapter.id, tallyHtml(chapter.content));
      }
      set({ manuscriptScanned: true });
      recompute();
    },
    /** Re-tally exactly one chapter. O(chapter), not O(novel). */
    scanChapter: (novelId, chapterId, html) => {
      if (!get().suggestionsEnabled) return;
      if (!novelId || get().activeNovelId !== novelId || tallyNovelId !== novelId) return;
      if (!chapterTallies.has(chapterId)) tallyOrder.push(chapterId);
      chapterTallies.set(chapterId, tallyHtml(html));
      recompute();
    },
    dropChapterTally: (chapterId) => {
      if (!chapterTallies.delete(chapterId)) return;
      tallyOrder = tallyOrder.filter((id) => id !== chapterId);
      recompute();
    },
    createEntryFromSuggestion: async (key, type) => {
      const suggestion = get().suggestions.find((s) => s.key === key);
      if (!suggestion) return null;
      set({ pendingSuggestionKey: key });
      const entry = await get().createEntry(type, suggestion.name);
      set({ pendingSuggestionKey: null });
      return entry;
    },
    dismissSuggestion: async (key) => {
      const { activeNovelId, suggestions } = get();
      const suggestion = suggestions.find((s) => s.key === key);
      if (!activeNovelId || !suggestion) return;
      set((state) => ({ dismissedKeys: [...state.dismissedKeys, key], error: null }));
      recompute();
      try {
        await codexService.dismissSuggestion(activeNovelId, suggestion.name);
      } catch (error) {
        console.error('Failed to dismiss suggestion:', error);
        if (get().activeNovelId !== activeNovelId) return;
        set((state) => ({
          dismissedKeys: state.dismissedKeys.filter((k) => k !== key),
          error: 'Could not hide that suggestion.',
        }));
        recompute();
      }
    },
    restoreDismissed: async () => {
      const { activeNovelId, dismissedKeys } = get();
      if (!activeNovelId || dismissedKeys.length === 0) return;
      set({ dismissedKeys: [], error: null });
      recompute();
      try {
        await codexService.restoreAllDismissedSuggestions(activeNovelId);
      } catch (error) {
        console.error('Failed to restore dismissed suggestions:', error);
        if (get().activeNovelId !== activeNovelId) return;
        set({ dismissedKeys, error: 'Could not restore dismissed suggestions.' });
        recompute();
      }
    },
    setSuggestionsEnabled: (enabled) => {
      try {
        localStorage.setItem(SUGGESTIONS_ENABLED_KEY, enabled ? 'on' : 'off');
      } catch {
        /* private mode */
      }
      if (!enabled) resetTallies(get().activeNovelId);
      set(
        enabled
          ? { suggestionsEnabled: true }
          : { suggestionsEnabled: false, suggestions: [], manuscriptScanned: false }
      );
      if (enabled) recompute();
    },
  };
});
