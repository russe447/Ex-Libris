import { create } from 'zustand';
import { ManuscriptChapter } from '@/types';
import { MIN_QUERY_LENGTH, SearchHit, SearchOptions, searchManuscript } from '@/lib/search';
import * as novelsService from '@/services/novels';
import { useEditorStore } from '@/stores/editorStore';
import { useLibraryStore } from '@/stores/libraryStore';

/** What the editor should scroll to and flash once the chapter is mounted. */
export interface PendingJump {
  chapterId: string;
  query: string;
  occurrence: number;
  options: SearchOptions;
  /** Bumped per request so clicking the same hit twice jumps again. */
  nonce: number;
}

interface SearchState {
  query: string;
  options: SearchOptions;
  results: SearchHit[];
  /** The query the current `results` belong to — avoids flashing stale hits. */
  resultsQuery: string;
  isSearching: boolean;
  error: string | null;
  pendingJump: PendingJump | null;

  setQuery: (query: string) => void;
  setOptions: (options: SearchOptions) => void;
  /** Fetches the manuscript and searches it. Safe to call on every keystroke. */
  run: () => Promise<void>;
  clear: () => void;
  requestJump: (hit: SearchHit) => void;
  consumeJump: () => void;
}

let runId = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let jumpNonce = 0;

/**
 * The manuscript is one request for the whole novel, so cache it briefly —
 * typing a six-letter query shouldn't mean six full-text downloads.
 */
const CACHE_TTL = 15_000;
let cache: { novelId: string; at: number; chapters: ManuscriptChapter[] } | null = null;

export function invalidateSearchCache(): void {
  cache = null;
}

async function loadManuscript(novelId: string): Promise<ManuscriptChapter[]> {
  if (cache && cache.novelId === novelId && Date.now() - cache.at < CACHE_TTL) {
    return cache.chapters;
  }
  const chapters = await novelsService.fetchManuscript(novelId);
  cache = { novelId, at: Date.now(), chapters };
  return chapters;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: '',
  options: { caseSensitive: false, wholeWord: false },
  results: [],
  resultsQuery: '',
  isSearching: false,
  error: null,
  pendingJump: null,

  setQuery: (query) => {
    set({ query });
    if (debounceTimer) clearTimeout(debounceTimer);
    if (query.trim().length < MIN_QUERY_LENGTH) {
      ++runId; // cancel anything in flight
      set({ results: [], resultsQuery: '', isSearching: false, error: null });
      return;
    }
    set({ isSearching: true });
    debounceTimer = setTimeout(() => void get().run(), 200);
  },

  setOptions: (options) => {
    set({ options: { ...get().options, ...options } });
    if (get().query.trim().length >= MIN_QUERY_LENGTH) void get().run();
  },

  run: async () => {
    const { query, options } = get();
    const trimmed = query.trim();
    const activeNovelId = useLibraryStore.getState().activeNovelId;

    if (!activeNovelId || trimmed.length < MIN_QUERY_LENGTH) {
      set({ results: [], resultsQuery: '', isSearching: false });
      return;
    }

    const id = ++runId;
    set({ isSearching: true, error: null });

    try {
      // Anything unsaved in the open chapter should be searchable too.
      await useEditorStore.getState().flush();
      const chapters = await loadManuscript(activeNovelId);
      if (id !== runId) return;

      // Prefer the live buffer over the server copy for the open chapter.
      const editor = useEditorStore.getState();
      const merged = chapters.map((chapter) =>
        chapter.id === editor.chapterId ? { ...chapter, content: editor.content } : chapter
      );

      set({
        results: searchManuscript(merged, trimmed, options),
        resultsQuery: trimmed,
        isSearching: false,
      });
    } catch (error) {
      console.error('Search failed:', error);
      if (id !== runId) return;
      set({ isSearching: false, error: 'Could not search this novel.' });
    }
  },

  clear: () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    ++runId;
    set({ query: '', results: [], resultsQuery: '', isSearching: false, error: null });
  },

  requestJump: (hit) => {
    set({
      pendingJump: {
        chapterId: hit.chapterId,
        query: get().resultsQuery || get().query.trim(),
        occurrence: hit.occurrence,
        options: get().options,
        nonce: ++jumpNonce,
      },
    });
  },

  consumeJump: () => set({ pendingJump: null }),
}));

// Switching novels must not leave another novel's hits on screen.
useLibraryStore.subscribe((state, previous) => {
  if (state.activeNovelId !== previous.activeNovelId) {
    invalidateSearchCache();
    useSearchStore.getState().clear();
    useSearchStore.setState({ pendingJump: null });
  }
});

// A saved chapter invalidates the cached manuscript, so the next search sees
// the new prose rather than a 15-second-old copy.
useEditorStore.subscribe((state, previous) => {
  if (state.lastSaved !== previous.lastSaved) invalidateSearchCache();
});
