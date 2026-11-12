// src/stores/snapshotStore.ts
//
// Chapter snapshots (Scrivener-style). Two invariants this store enforces:
//
//  1. "Snapshot" means "what is persisted". Before creating or restoring, the
//     editor is flushed; if that flush fails, the operation is aborted rather
//     than capture (or overwrite) something that doesn't match the screen.
//  2. Restoring can't destroy work. The server writes an automatic backup of
//     the current text in the same transaction as the overwrite, and the
//     buffer swap goes through editorStore.replaceChapterContent, which
//     cancels any pending autosave before replacing the content.
//
// The list is loaded lazily (when the dialog opens or the menu asks), never on
// chapter switch — snapshots cost nothing until you look at them.

import { create } from 'zustand';
import { ChapterSnapshot } from '@/types';
import * as snapshotsService from '@/services/snapshots';
import { useEditorStore } from '@/stores/editorStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { invalidateSearchCache } from '@/stores/searchStore';

interface SnapshotState {
  /** The chapter the current list belongs to. */
  chapterId: string | null;
  novelId: string | null;
  snapshots: ChapterSnapshot[];
  isLoading: boolean;
  /** A create/rename/delete/restore is in flight. */
  isWorking: boolean;
  error: string | null;
  /** Feedback for the quick "Take Snapshot" action (menu or button). */
  lastTakenAt: Date | null;

  /** Load the list for the currently open chapter. */
  openForCurrentChapter: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Flushes the editor, then snapshots the persisted chapter. */
  create: (name?: string) => Promise<ChapterSnapshot | null>;
  rename: (snapshotId: string, name: string) => Promise<void>;
  remove: (snapshotId: string) => Promise<void>;
  /** Returns true on success. The pre-restore text is backed up server-side. */
  restore: (snapshotId: string) => Promise<boolean>;
  clearError: () => void;
}

/**
 * Persist the open chapter and report whether the database now matches the
 * buffer. Both create and restore refuse to proceed on a failed save.
 */
async function flushEditor(): Promise<boolean> {
  await useEditorStore.getState().flush();
  return !useEditorStore.getState().hasUnsavedChanges;
}

function currentChapter(): { novelId: string; chapterId: string } | null {
  const { novelId, chapterId } = useEditorStore.getState();
  return novelId && chapterId ? { novelId, chapterId } : null;
}

export const useSnapshotStore = create<SnapshotState>((set, get) => ({
  chapterId: null,
  novelId: null,
  snapshots: [],
  isLoading: false,
  isWorking: false,
  error: null,
  lastTakenAt: null,

  openForCurrentChapter: async () => {
    const target = currentChapter();
    if (!target) return;
    set({
      chapterId: target.chapterId,
      novelId: target.novelId,
      isLoading: true,
      error: null,
      // Showing another chapter's list, even briefly, would be worse than a
      // spinner.
      snapshots: get().chapterId === target.chapterId ? get().snapshots : [],
    });
    try {
      const snapshots = await snapshotsService.fetchSnapshots(target.novelId, target.chapterId);
      if (get().chapterId !== target.chapterId) return; // switched mid-flight
      set({ snapshots, isLoading: false });
    } catch (error) {
      console.error('Failed to load snapshots:', error);
      set({ isLoading: false, error: 'Could not load snapshots.' });
    }
  },

  refresh: async () => {
    const { novelId, chapterId } = get();
    if (!novelId || !chapterId) return;
    try {
      const snapshots = await snapshotsService.fetchSnapshots(novelId, chapterId);
      if (get().chapterId !== chapterId) return;
      set({ snapshots });
    } catch (error) {
      console.error('Failed to refresh snapshots:', error);
    }
  },

  create: async (name = '') => {
    const target = currentChapter();
    if (!target || get().isWorking) return null;
    set({ isWorking: true, error: null });
    try {
      if (!(await flushEditor())) {
        set({
          isWorking: false,
          error: 'Could not save the chapter first — snapshot not taken.',
        });
        return null;
      }
      const snapshot = await snapshotsService.createSnapshot(
        target.novelId,
        target.chapterId,
        name
      );
      set((state) => ({
        isWorking: false,
        lastTakenAt: new Date(),
        // Prepend only if the list on screen is this chapter's.
        snapshots:
          state.chapterId === target.chapterId
            ? [snapshot, ...state.snapshots]
            : state.snapshots,
      }));
      return snapshot;
    } catch (error) {
      console.error('Failed to create snapshot:', error);
      set({
        isWorking: false,
        error: error instanceof Error ? error.message : 'Could not take the snapshot.',
      });
      return null;
    }
  },

  rename: async (snapshotId, name) => {
    const { novelId, chapterId } = get();
    if (!novelId || !chapterId) return;
    const previous = get().snapshots;
    set({
      snapshots: previous.map((s) => (s.id === snapshotId ? { ...s, name } : s)),
      error: null,
    });
    try {
      await snapshotsService.renameSnapshot(novelId, chapterId, snapshotId, name);
    } catch (error) {
      console.error('Failed to rename snapshot:', error);
      set({ snapshots: previous, error: 'Could not rename the snapshot.' });
    }
  },

  remove: async (snapshotId) => {
    const { novelId, chapterId } = get();
    if (!novelId || !chapterId) return;
    const previous = get().snapshots;
    set({ snapshots: previous.filter((s) => s.id !== snapshotId), error: null });
    try {
      await snapshotsService.deleteSnapshot(novelId, chapterId, snapshotId);
    } catch (error) {
      console.error('Failed to delete snapshot:', error);
      set({ snapshots: previous, error: 'Could not delete the snapshot.' });
    }
  },

  restore: async (snapshotId) => {
    const { novelId, chapterId } = get();
    if (!novelId || !chapterId || get().isWorking) return false;
    // The restore targets the chapter this list belongs to; if the author has
    // since opened a different chapter, bail out rather than surprise them.
    const open = currentChapter();
    if (!open || open.chapterId !== chapterId) {
      set({ error: 'This chapter is no longer open — restore cancelled.' });
      return false;
    }
    set({ isWorking: true, error: null });
    try {
      // Persist the text on screen first: the server's automatic backup can
      // only protect what has reached the database.
      if (!(await flushEditor())) {
        set({
          isWorking: false,
          error: 'Could not save your current text — restore cancelled, nothing changed.',
        });
        return false;
      }
      const { chapter } = await snapshotsService.restoreSnapshot(novelId, chapterId, snapshotId);
      // Swap the buffer (no-ops safely if a chapter switch raced us; the
      // restored text is persisted either way and will load on next open).
      // Swap the buffer (no-ops safely if a chapter switch raced us; the
      // restored text is persisted either way and will load on next open).
      // Word counts propagate to the sidebar by themselves — libraryStore
      // already observes editorStore.wordCount; only lastModified is ours.
      useEditorStore.getState().replaceChapterContent(chapter);
      useLibraryStore.setState((state) => ({
        chapters: state.chapters.map((c) =>
          c.id === chapter.id ? { ...c, lastModified: chapter.lastModified } : c
        ),
      }));
      invalidateSearchCache();
      set({ isWorking: false });
      await get().refresh(); // picks up the automatic backup
      return true;
    } catch (error) {
      console.error('Failed to restore snapshot:', error);
      set({
        isWorking: false,
        error: error instanceof Error ? error.message : 'Could not restore the snapshot.',
      });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));
