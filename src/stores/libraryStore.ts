import { create } from 'zustand';
import { ChapterSummary, NovelSummary } from '@/types';
import { generateId } from '@/lib/utils';
import * as novelsService from '@/services/novels';
import * as chaptersService from '@/services/chapters';
import { useEditorStore } from '@/stores/editorStore';
import { useChatStore } from '@/stores/chatStore';
import { useCodexStore } from '@/stores/codexStore';
const LS_ACTIVE_NOVEL = 'exlibris_active_novel';
const LS_LAST_CHAPTERS = 'exlibris_last_chapter_by_novel';
const LS_LEGACY_DOCUMENT = 'exlibris_active_document';
interface LibraryState {
  novels: NovelSummary[];
  activeNovelId: string | null;
  /** Chapters of the active novel only, always in `position` order. */
  chapters: ChapterSummary[];
  activeChapterId: string | null;
  isLoadingNovels: boolean;
  isLoadingChapters: boolean;
  isMutating: boolean;
  error: string | null;
  bootstrap: () => Promise<void>;
  fetchNovels: () => Promise<void>;
  createNovel: () => Promise<string | null>;
  openNovel: (novelId: string) => Promise<void>;
  renameNovel: (novelId: string, title: string) => Promise<void>;
  deleteNovel: (novelId: string) => Promise<void>;
  closeNovel: () => void;
  createChapter: () => Promise<string | null>;
  openChapter: (chapterId: string) => Promise<void>;
  renameChapter: (chapterId: string, title: string) => Promise<void>;
  deleteChapter: (chapterId: string) => Promise<void>;
  reorderChapters: (orderedIds: string[]) => Promise<void>;
}
/** Guards against out-of-order fetches when the user clicks faster than the network. */
let novelRequestId = 0;
let chapterRequestId = 0;
function readLastChapters(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LS_LAST_CHAPTERS) ?? '{}');
  } catch {
    return {};
  }
}
function rememberChapter(novelId: string, chapterId: string): void {
  try {
    localStorage.setItem(LS_LAST_CHAPTERS, JSON.stringify({ ...readLastChapters(), [novelId]: chapterId }));
  } catch {
    /* private mode */
  }
}
export const useLibraryStore = create<LibraryState>((set, get) => ({
  novels: [],
  activeNovelId: null,
  chapters: [],
  activeChapterId: null,
  isLoadingNovels: false,
  isLoadingChapters: false,
  isMutating: false,
  error: null,
  bootstrap: async () => {
    try {
      localStorage.removeItem(LS_LEGACY_DOCUMENT); // v1 key, now meaningless
    } catch {
      /* ignore */
    }
    await get().fetchNovels();
    let savedNovelId: string | null = null;
    try {
      savedNovelId = localStorage.getItem(LS_ACTIVE_NOVEL);
    } catch {
      /* ignore */
    }
    if (savedNovelId && get().novels.some((novel) => novel.id === savedNovelId)) {
      await get().openNovel(savedNovelId);
    }
  },
  fetchNovels: async () => {
    set({ isLoadingNovels: true });
    try {
      set({ novels: await novelsService.fetchNovels(), isLoadingNovels: false });
    } catch (error) {
      console.error('Failed to fetch novels:', error);
      set({ isLoadingNovels: false, error: 'Could not load your novels.' });
    }
  },
  createNovel: async () => {
    set({ isMutating: true, error: null });
    try {
      const novel = await novelsService.createNovel({ id: generateId(), title: 'Untitled Novel' });
      set((state) => ({ novels: [novel, ...state.novels], isMutating: false }));
      await get().openNovel(novel.id);
      return novel.id;
    } catch (error) {
      console.error('Failed to create novel:', error);
      set({ isMutating: false, error: 'Could not create the novel.' });
      return null;
    }
  },
  openNovel: async (novelId) => {
    if (get().activeNovelId === novelId) return;
    // Never abandon the current chapter's edits on a switch.
    await useEditorStore.getState().flush();
    const requestId = ++novelRequestId;
    set({
      activeNovelId: novelId,
      chapters: [],
      activeChapterId: null,
      isLoadingChapters: true,
      error: null,
    });
    useEditorStore.getState().closeChapter();
    // Chat + codex are novel-scoped: this is the ONLY place they're swapped.
    // Switching chapters within a novel must never touch them.
    void useChatStore.getState().setActiveNovel(novelId);
    void useCodexStore.getState().setActiveNovel(novelId);
    try {
      localStorage.setItem(LS_ACTIVE_NOVEL, novelId);
    } catch {
      /* ignore */
    }
    try {
      const novel = await novelsService.fetchNovel(novelId);
      if (requestId !== novelRequestId) return;
      set({ chapters: novel.chapters, isLoadingChapters: false });
      const remembered = readLastChapters()[novelId];
      const target = novel.chapters.find((c) => c.id === remembered) ?? novel.chapters[0];
      if (target) await get().openChapter(target.id);
    } catch (error) {
      console.error('Failed to open novel:', error);
      if (requestId !== novelRequestId) return;
      set({ isLoadingChapters: false, error: 'Could not open that novel.' });
    }
  },
  renameNovel: async (novelId, title) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const previous = get().novels;
    set({
      novels: previous.map((n) => (n.id === novelId ? { ...n, title: trimmed } : n)),
      error: null,
    });
    try {
      await novelsService.renameNovel(novelId, trimmed);
    } catch (error) {
      console.error('Failed to rename novel:', error);
      set({ novels: previous, error: 'Could not rename the novel.' });
    }
  },
  deleteNovel: async (novelId) => {
    const previous = get().novels;
    if (get().activeNovelId === novelId) get().closeNovel();
    set({ novels: previous.filter((n) => n.id !== novelId) });
    try {
      await novelsService.deleteNovel(novelId);
    } catch (error) {
      console.error('Failed to delete novel:', error);
      set({ novels: previous, error: 'Could not delete the novel.' });
    }
  },
  closeNovel: () => {
    useEditorStore.getState().closeChapter();
    void useChatStore.getState().setActiveNovel(null);
    void useCodexStore.getState().setActiveNovel(null);
    try {
      localStorage.removeItem(LS_ACTIVE_NOVEL);
    } catch {
      /* ignore */
    }
    set({ activeNovelId: null, activeChapterId: null, chapters: [], error: null });
  },
  createChapter: async () => {
    const { activeNovelId, chapters } = get();
    if (!activeNovelId) return null;
    await useEditorStore.getState().flush();
    set({ isMutating: true, error: null });
    try {
      const chapter = await chaptersService.createChapter(activeNovelId, {
        id: generateId(),
        title: `Chapter ${chapters.length + 1}`,
      });
      if (get().activeNovelId !== activeNovelId) {
        set({ isMutating: false });
        return null;
      }
      const { content: _content, ...summary } = chapter;
      set((state) => ({
        chapters: [...state.chapters, summary],
        activeChapterId: chapter.id,
        isMutating: false,
      }));
      // We already have the full chapter — don't re-fetch it.
      ++chapterRequestId;
      useEditorStore.getState().loadChapter(chapter);
      rememberChapter(activeNovelId, chapter.id);
      return chapter.id;
    } catch (error) {
      console.error('Failed to create chapter:', error);
      set({ isMutating: false, error: 'Could not create the chapter.' });
      return null;
    }
  },
  openChapter: async (chapterId) => {
    const { activeNovelId, activeChapterId } = get();
    if (!activeNovelId || activeChapterId === chapterId) return;
    await useEditorStore.getState().flush();
    const requestId = ++chapterRequestId;
    set({ activeChapterId: chapterId, error: null });
    useEditorStore.getState().beginLoad();
    rememberChapter(activeNovelId, chapterId);
    try {
      const chapter = await chaptersService.fetchChapter(activeNovelId, chapterId);
      if (requestId !== chapterRequestId) return;
      useEditorStore.getState().loadChapter(chapter);
    } catch (error) {
      console.error('Failed to open chapter:', error);
      if (requestId !== chapterRequestId) return;
      useEditorStore.getState().closeChapter();
      set({ activeChapterId: null, error: 'Could not open that chapter.' });
    }
  },
  renameChapter: async (chapterId, title) => {
    const { activeNovelId, chapters } = get();
    const trimmed = title.trim();
    if (!activeNovelId || !trimmed) return;
    const previous = chapters;
    set({
      chapters: previous.map((c) => (c.id === chapterId ? { ...c, title: trimmed } : c)),
      error: null,
    });
    try {
      // Partial PUT — no content round-trip, even for a chapter that isn't open.
      await chaptersService.updateChapter(activeNovelId, chapterId, { title: trimmed });
    } catch (error) {
      console.error('Failed to rename chapter:', error);
      if (get().activeNovelId !== activeNovelId) return;
      set({ chapters: previous, error: 'Could not rename the chapter.' });
    }
  },
  deleteChapter: async (chapterId) => {
    const { activeNovelId, chapters, activeChapterId } = get();
    if (!activeNovelId) return;
    const index = chapters.findIndex((c) => c.id === chapterId);
    if (index === -1) return;
    const previous = chapters;
    const next = chapters
      .filter((c) => c.id !== chapterId)
      .map((chapter, position) => ({ ...chapter, position }));
    set({ chapters: next, error: null });
    if (activeChapterId === chapterId) {
      // Drop the buffer WITHOUT flushing — we're about to delete it.
      useEditorStore.getState().closeChapter();
      set({ activeChapterId: null });
      const fallback = next[Math.min(index, next.length - 1)];
      if (fallback) await get().openChapter(fallback.id);
    }
    try {
      await chaptersService.deleteChapter(activeNovelId, chapterId);
      useCodexStore.getState().dropChapterTally(chapterId);
    } catch (error) {
      console.error('Failed to delete chapter:', error);
      if (get().activeNovelId !== activeNovelId) return;
      set({ chapters: previous, error: 'Could not delete the chapter.' });
    }
  },
  reorderChapters: async (orderedIds) => {
    const { activeNovelId, chapters } = get();
    if (!activeNovelId) return;
    const byId = new Map(chapters.map((chapter) => [chapter.id, chapter]));
    if (orderedIds.length !== chapters.length || orderedIds.some((id) => !byId.has(id))) return;
    const previous = chapters;
    set({
      chapters: orderedIds.map((id, position) => ({ ...byId.get(id)!, position })),
      error: null,
    });
    try {
      await chaptersService.reorderChapters(activeNovelId, orderedIds);
    } catch (error) {
      console.error('Failed to reorder chapters:', error);
      if (get().activeNovelId !== activeNovelId) return;
      set({ chapters: previous, error: 'Could not save the new chapter order.' });
    }
  },
}));
/**
 * Keep the sidebar's word counts live while typing.
 *
 * This runs the dependency the "wrong" way on purpose: `editorStore` never
 * imports `libraryStore`, so there's no cycle. The library observes the editor,
 * not the other way round.
 */
useEditorStore.subscribe((state, previous) => {
  if (state.wordCount === previous.wordCount || !state.chapterId) return;
  useLibraryStore.setState((library) => {
    const chapters = library.chapters.map((chapter) =>
      chapter.id === state.chapterId ? { ...chapter, wordCount: state.wordCount } : chapter
    );
    const total = chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);
    return {
      chapters,
      novels: library.novels.map((novel) =>
        novel.id === library.activeNovelId ? { ...novel, wordCount: total } : novel
      ),
    };
  });
});
