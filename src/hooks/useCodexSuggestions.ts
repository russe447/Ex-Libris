import { useEffect } from 'react';
import { useCodexStore } from '@/stores/codexStore';
import { useEditorStore } from '@/stores/editorStore';
import { useLibraryStore } from '@/stores/libraryStore';
import * as novelsService from '@/services/novels';
const SCAN_DEBOUNCE_MS = 800;
function runWhenIdle(callback: () => void): () => void {
  if (window.requestIdleCallback) {
    const handle = window.requestIdleCallback(callback, { timeout: 2000 });
    return () => window.cancelIdleCallback?.(handle);
  }
  const handle = window.setTimeout(callback, 0);
  return () => window.clearTimeout(handle);
}
/**
 * Keeps codex suggestions in sync with the whole novel.
 *
 * Two phases:
 *  1. On novel open, fetch the manuscript once and tally every chapter. This is
 *     the only O(novel) pass, and it runs on an idle callback.
 *  2. While typing, re-tally ONLY the active chapter. Tallies are additive, so
 *     merging them reproduces a full-novel scan exactly, for a fraction of the
 *     cost.
 *
 * Still imperative: subscribing (rather than selecting) means typing never
 * re-renders the Codex panel. Still scoped to <CodexPanel />'s lifetime, so
 * writing with another tab open costs nothing.
 */
export function useCodexSuggestionScan(enabled: boolean): void {
  const activeNovelId = useCodexStore((state) => state.activeNovelId);
  // Phase 1 — one full-manuscript tally per novel.
  useEffect(() => {
    if (!enabled || !activeNovelId) return;
    if (useCodexStore.getState().manuscriptScanned) return;
    let cancelled = false;
    let cancelIdle: (() => void) | null = null;
    void (async () => {
      try {
        const chapters = await novelsService.fetchManuscript(activeNovelId);
        if (cancelled || useCodexStore.getState().activeNovelId !== activeNovelId) return;
        cancelIdle = runWhenIdle(() => {
          if (cancelled) return;
          useCodexStore.getState().ingestManuscript(activeNovelId, chapters);
          // The server's copy of the open chapter can be up to one autosave
          // stale. Overwrite it with the live buffer.
          const { chapterId, content } = useEditorStore.getState();
          if (chapterId) useCodexStore.getState().scanChapter(activeNovelId, chapterId, content);
        });
      } catch (error) {
        console.warn('Could not scan the manuscript for codex suggestions:', error);
      }
    })();
    return () => {
      cancelled = true;
      cancelIdle?.();
    };
  }, [enabled, activeNovelId]);
  // Phase 2 — re-tally the active chapter as it changes.
  useEffect(() => {
    if (!enabled || !activeNovelId) return;
    let debounceTimer: number | undefined;
    let cancelIdle: (() => void) | null = null;
    const scan = () => {
      const { chapterId, content } = useEditorStore.getState();
      const novelId = useLibraryStore.getState().activeNovelId;
      if (!chapterId || !novelId) return;
      useCodexStore.getState().scanChapter(novelId, chapterId, content);
    };
    const schedule = (delay: number) => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        cancelIdle = runWhenIdle(scan);
      }, delay);
    };
    const unsubscribe = useEditorStore.subscribe((state, previous) => {
      // A chapter switch re-tallies immediately; typing waits for the debounce.
      if (state.chapterId !== previous.chapterId) schedule(0);
      else if (state.content !== previous.content) schedule(SCAN_DEBOUNCE_MS);
    });
    return () => {
      window.clearTimeout(debounceTimer);
      cancelIdle?.();
      unsubscribe();
    };
  }, [enabled, activeNovelId]);
}
